export type Role = "ADMIN" | "USER";
export type UserType = "STUDENT" | "LECTURER" | "STAFF";
export type IdentityType = "NIM" | "NIDN" | "NIP" | "EMPLOYEE_ID";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type ItemType = "LOST" | "FOUND";
export type ItemStatus = "OPEN" | "CLAIM_PENDING" | "RETURNED" | "CLOSED" | "REJECTED";
export type ClaimStatus = "PENDING" | "NEED_INFO" | "APPROVED" | "REJECTED" | "CANCELLED";
export type MatchStatus = "SUGGESTED" | "CONFIRMED" | "DISMISSED";

export const ITEM_TYPES: ItemType[] = ["LOST", "FOUND"];
export const ITEM_STATUSES: ItemStatus[] = ["OPEN", "CLAIM_PENDING", "RETURNED", "CLOSED", "REJECTED"];
export const CLAIM_STATUSES: ClaimStatus[] = ["PENDING", "NEED_INFO", "APPROVED", "REJECTED", "CANCELLED"];
export const ACCOUNT_STATUSES: AccountStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];
export const USER_TYPES: UserType[] = ["STUDENT", "LECTURER", "STAFF"];

/** Pengguna yang sudah terautentikasi (selalu dibaca ulang dari database, bukan dari klien). */
export interface SessionUser {
  userId: number;
  role: Role;
  userType: UserType | null;
  fullName: string;
  email: string;
  username: string | null;
  identityType: IdentityType | null;
  identityNumber: string | null;
  phoneNumber: string | null;
  accountStatus: AccountStatus;
}

/** Hasil Server Action untuk form (useActionState). */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
} | null;
