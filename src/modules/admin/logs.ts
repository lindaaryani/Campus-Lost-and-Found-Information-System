import { config } from "@/lib/config";
import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { AdminError } from "./users";

export interface AuditRow {
  logId: number; actorName: string | null; action: string; entityType: string; entityId: number | null;
  details: Record<string, unknown> | null; createdAt: string;
}

/** FR-32: log aktivitas (status laporan, keputusan klaim, tindakan administratif). */
export async function listAuditLogs(admin: SessionUser, opts: { action?: string; entity?: string; page?: number }) {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  const where: string[] = []; const params: unknown[] = [];
  if (opts.action) { where.push("a.action = ?"); params.push(opts.action); }
  if (opts.entity) { where.push("a.entity_type = ?"); params.push(opts.entity); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = 20;
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM audit_logs a ${w}`, params);
  const rows = await query<{ log_id: number; full_name: string | null; action: string; entity_type: string; entity_id: number | null; details: unknown; created_at: string }>(
    `SELECT a.log_id, u.full_name, a.action, a.entity_type, a.entity_id, a.details, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.actor_id
       ${w} ORDER BY a.created_at DESC, a.log_id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  const actions = await query<{ action: string }>("SELECT DISTINCT action FROM audit_logs ORDER BY action");
  const list: AuditRow[] = rows.map((r) => ({
    logId: r.log_id, actorName: r.full_name, action: r.action, entityType: r.entity_type, entityId: r.entity_id,
    details: typeof r.details === "string" ? JSON.parse(r.details) : (r.details as Record<string, unknown> | null),
    createdAt: r.created_at,
  }));
  return { rows: list, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), actions: actions.map((a) => a.action) };
}

export { config };
