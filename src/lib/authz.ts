import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { SessionUser } from "./types";

export class AuthzError extends Error {
  constructor(message = "Anda tidak memiliki akses untuk tindakan ini.") {
    super(message);
  }
}

/** Untuk halaman USER: alihkan ke login bila belum masuk, ke dashboard admin bila ADMIN. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "USER") redirect("/admin");
  return u;
}

/** Untuk halaman ADMIN: pengguna biasa dialihkan ke dashboard mereka. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN") redirect("/dashboard");
  return u;
}

/** Untuk Server Action / Route Handler: lempar error (bukan redirect) agar bisa ditangani. */
export async function assertUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u || u.role !== "USER") throw new AuthzError("Sesi tidak valid. Silakan masuk kembali.");
  return u;
}
export async function assertAdmin(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN") throw new AuthzError("Hanya administrator yang dapat melakukan tindakan ini.");
  return u;
}
