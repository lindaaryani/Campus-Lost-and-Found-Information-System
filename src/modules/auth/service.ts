import { config } from "@/lib/config";
import { exec, queryOne } from "@/lib/db";
import { dummyVerify, hashPassword, verifyPassword } from "@/lib/password";
import { rateLimitCheck, rateLimitHit, rateLimitReset } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import type { AccountStatus, IdentityType, Role, UserType } from "@/lib/types";

const WINDOW = 15 * 60_000;
const GENERIC_FAIL = "Identitas atau kata sandi salah. Periksa kembali isian Anda.";

export type AuthResult =
  | { ok: true; userId: number; role: Role }
  | { ok: false; message: string };

interface LoginInput {
  accountType: "USER" | "ADMIN";
  userType?: UserType; identityType?: IdentityType; identityNumber?: string; username?: string;
  password: string;
}

/**
 * FR-01/02/04/05: autentikasi satu pintu untuk USER (identity_type + identity_number + user_type) dan ADMIN (username).
 * Role & status diambil dari database. Pesan galat sengaja generik agar identitas valid tidak bisa ditebak.
 * Pembatasan percobaan: 5 kegagalan / 15 menit per identitas, 30 / 15 menit per IP.
 */
export async function authenticate(input: LoginInput, ip: string): Promise<AuthResult> {
  const idKey = `login:${input.accountType}:${(input.accountType === "ADMIN" ? input.username : `${input.identityType}:${input.identityNumber}`)?.toLowerCase()}`;
  const ipKey = `login-ip:${ip}`;
  for (const [k, max] of [[idKey, 5], [ipKey, 30]] as const) {
    const rl = rateLimitCheck(k, max);
    if (!rl.allowed) {
      return { ok: false, message: `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(rl.retryAfterSec / 60)} menit.` };
    }
  }

  const user =
    input.accountType === "ADMIN"
      ? await queryOne<{ user_id: number; role: Role; password_hash: string; account_status: AccountStatus }>(
          "SELECT user_id, role, password_hash, account_status FROM users WHERE role = 'ADMIN' AND username = ?",
          [input.username],
        )
      : await queryOne<{ user_id: number; role: Role; password_hash: string; account_status: AccountStatus }>(
          `SELECT user_id, role, password_hash, account_status FROM users
            WHERE role = 'USER' AND user_type = ? AND identity_type = ? AND identity_number = ?`,
          [input.userType, input.identityType, input.identityNumber],
        );

  if (!user) {
    await dummyVerify(input.password);
    rateLimitHit(idKey, WINDOW); rateLimitHit(ipKey, WINDOW);
    return { ok: false, message: GENERIC_FAIL };
  }
  const valid = await verifyPassword(user.password_hash, input.password);
  if (!valid) {
    rateLimitHit(idKey, WINDOW); rateLimitHit(ipKey, WINDOW);
    return { ok: false, message: GENERIC_FAIL };
  }
  if (user.account_status !== "ACTIVE") {
    // Kredensial benar, tetapi akun tidak boleh masuk (FR-05).
    return { ok: false, message: "Akun Anda sedang tidak aktif. Hubungi administrator kampus untuk bantuan." };
  }
  rateLimitReset(idKey);
  return { ok: true, userId: user.user_id, role: user.role };
}

export class RegisterError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

interface RegisterInput {
  userType: UserType; identityType: IdentityType; identityNumber: string; fullName: string;
  email: string; phoneNumber: string | null; password: string;
}

/**
 * Registrasi mandiri USER. CATATAN KEAMANAN: SKPL (BR-05) belum menetapkan verifikasi identitas,
 * sehingga siapa pun yang mengetahui format identitas dapat mendaftar. Lihat docs/ASSUMPTIONS.md.
 */
export async function registerUser(input: RegisterInput): Promise<number> {
  if (!config.allowSelfRegistration) throw new RegisterError("Pendaftaran mandiri sedang ditutup. Hubungi administrator.");
  const passwordHash = await hashPassword(input.password);
  try {
    const res = await exec(
      `INSERT INTO users (identity_type, identity_number, user_type, full_name, email, phone_number, password_hash, role, account_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'USER', 'ACTIVE')`,
      [input.identityType, input.identityNumber, input.userType, input.fullName, input.email, input.phoneNumber, passwordHash],
    );
    await writeAudit(res.insertId, "USER_REGISTERED", "user", res.insertId, { userType: input.userType });
    return res.insertId;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "ER_DUP_ENTRY") {
      if (err.message?.includes("uq_users_email")) throw new RegisterError("Email ini sudah terdaftar.", "email");
      throw new RegisterError("Nomor identitas ini sudah terdaftar. Jika itu milik Anda, silakan masuk.", "identityNumber");
    }
    throw e;
  }
}

/** FR-07: perbarui profil (identitas kampus & tipe akun tidak dapat diubah sendiri). */
export async function updateProfile(userId: number, v: { fullName: string; email: string; phoneNumber: string | null }) {
  try {
    await exec("UPDATE users SET full_name = ?, email = ?, phone_number = ? WHERE user_id = ?", [v.fullName, v.email, v.phoneNumber, userId]);
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new RegisterError("Email ini sudah dipakai akun lain.", "email");
    throw e;
  }
}
