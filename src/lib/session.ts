import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { config } from "./config";
import { exec, queryOne } from "./db";
import type { SessionUser } from "./types";

/**
 * Sesi server-side:
 *  - token acak 256-bit dikirim sebagai cookie HttpOnly; database hanya menyimpan hash SHA-256-nya;
 *  - role & user_type SELALU dibaca dari database pada setiap permintaan (tidak pernah dari klien);
 *  - akun yang tidak ACTIVE otomatis tidak lagi memiliki sesi valid (FR-05);
 *  - logout menghapus baris sesi sehingga cookie lama tidak bisa dipakai lagi (FR-27, NFR-13).
 */
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: number): Promise<void> {
  const jar = await cookies();
  const previous = jar.get(config.sessionCookie)?.value;
  if (previous && previous.length <= 128) await exec("DELETE FROM sessions WHERE session_id = ?", [sha256(previous)]);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + config.sessionTtlHours * 3600_000);
  await exec("INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)", [
    sha256(token), userId, expires,
  ]);
  jar.set(config.sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  // Housekeeping ringan: hapus sesi kedaluwarsa.
  void exec("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()").catch(() => {});
}

interface Row {
  user_id: number; role: SessionUser["role"]; user_type: SessionUser["userType"];
  full_name: string; email: string; username: string | null;
  identity_type: SessionUser["identityType"]; identity_number: string | null;
  phone_number: string | null; account_status: SessionUser["accountStatus"];
}

/** Pengguna saat ini (di-cache per-request). null jika belum login / sesi tidak valid / akun tidak aktif. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(config.sessionCookie)?.value;
  if (!token || token.length > 128) return null;
  const row = await queryOne<Row>(
    `SELECT u.user_id, u.role, u.user_type, u.full_name, u.email, u.username,
            u.identity_type, u.identity_number, u.phone_number, u.account_status
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.session_id = ? AND s.expires_at > UTC_TIMESTAMP() AND u.account_status = 'ACTIVE'`,
    [sha256(token)],
  );
  if (!row) return null;
  return {
    userId: row.user_id, role: row.role, userType: row.user_type, fullName: row.full_name,
    email: row.email, username: row.username, identityType: row.identity_type,
    identityNumber: row.identity_number, phoneNumber: row.phone_number, accountStatus: row.account_status,
  };
});

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(config.sessionCookie)?.value;
  if (token && token.length <= 128) await exec("DELETE FROM sessions WHERE session_id = ?", [sha256(token)]);
  jar.delete(config.sessionCookie);
}

/** Cabut semua sesi pengguna (dipakai saat akun dinonaktifkan/ditangguhkan). */
export async function revokeUserSessions(userId: number): Promise<void> {
  await exec("DELETE FROM sessions WHERE user_id = ?", [userId]);
}
