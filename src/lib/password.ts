import { hash, verify } from "@node-rs/argon2";

/** NFR-01: Argon2id (algoritma default @node-rs/argon2). Tidak ada password plaintext yang disimpan. */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;
/** Hash palsu untuk menyamakan waktu respons saat identitas tidak ditemukan (anti user-enumeration). */
export function dummyVerify(plain: string): Promise<boolean> {
  dummy ??= hashPassword("dummy-password-for-timing");
  return dummy.then((h) => verifyPassword(h, plain));
}
