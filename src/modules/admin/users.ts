import { config } from "@/lib/config";
import { query, queryOne, withTransaction, exec } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { escapeLike } from "@/lib/utils";
import { revokeUserSessions } from "@/lib/session";
import type { AccountStatus, IdentityType, Role, SessionUser, UserType } from "@/lib/types";

export class AdminError extends Error {}

export interface UserRow {
  userId: number; fullName: string; email: string; role: Role; userType: UserType | null;
  identityType: IdentityType | null; identityNumber: string | null; username: string | null;
  accountStatus: AccountStatus; createdAt: string; reportCount: number; claimCount: number;
}

/** FR-24: daftar & pencarian akun. */
export async function listUsers(
  admin: SessionUser, f: { q?: string; role?: Role; status?: AccountStatus; userType?: UserType; page?: number },
) {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  const where: string[] = []; const params: unknown[] = [];
  if (f.role) { where.push("u.role = ?"); params.push(f.role); }
  if (f.status) { where.push("u.account_status = ?"); params.push(f.status); }
  if (f.userType) { where.push("u.user_type = ?"); params.push(f.userType); }
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.identity_number LIKE ? OR u.username LIKE ?)");
    params.push(like, like, like, like);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, f.page ?? 1);
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM users u ${w}`, params);
  const rows = await query<Record<string, unknown>>(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.user_type, u.identity_type, u.identity_number, u.username,
            u.account_status, u.created_at,
            (SELECT COUNT(*) FROM items i WHERE i.user_id = u.user_id) AS report_count,
            (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.user_id) AS claim_count
       FROM users u ${w} ORDER BY u.created_at DESC, u.user_id DESC LIMIT ? OFFSET ?`,
    [...params, config.pageSize, (page - 1) * config.pageSize],
  );
  const list: UserRow[] = rows.map((r) => ({
    userId: r.user_id as number, fullName: r.full_name as string, email: r.email as string, role: r.role as Role,
    userType: r.user_type as UserType | null, identityType: r.identity_type as IdentityType | null,
    identityNumber: r.identity_number as string | null, username: r.username as string | null,
    accountStatus: r.account_status as AccountStatus, createdAt: r.created_at as string,
    reportCount: Number(r.report_count), claimCount: Number(r.claim_count),
  }));
  return { rows: list, total, page, pageCount: Math.max(1, Math.ceil(total / config.pageSize)) };
}

/** FR-24: ubah status akun. Sesi akun yang dinonaktifkan langsung dicabut. */
export async function changeAccountStatus(admin: SessionUser, targetId: number, status: AccountStatus, note: string | null) {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  if (targetId === admin.userId) throw new AdminError("Anda tidak dapat mengubah status akun Anda sendiri.");
  await withTransaction(async (conn) => {
    const t = await queryOne<{ role: Role; account_status: AccountStatus; full_name: string }>(
      "SELECT role, account_status, full_name FROM users WHERE user_id = ? FOR UPDATE", [targetId], conn,
    );
    if (!t) throw new AdminError("Akun tidak ditemukan.");
    if (t.account_status === status) throw new AdminError("Akun sudah berstatus tersebut.");
    if (t.role === "ADMIN" && status !== "ACTIVE") {
      const [{ c }] = await query<{ c: number }>(
        "SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN' AND account_status = 'ACTIVE' AND user_id <> ?", [targetId], conn);
      if (c < 1) throw new AdminError("Minimal harus ada satu akun ADMIN yang aktif.");
    }
    await exec("UPDATE users SET account_status = ? WHERE user_id = ?", [status, targetId], conn);
    await writeAudit(admin.userId, "USER_STATUS_CHANGED", "user", targetId, { from: t.account_status, to: status, note }, conn);
  });
  if (status !== "ACTIVE") await revokeUserSessions(targetId);
}
