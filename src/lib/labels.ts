import type {
  AccountStatus, ClaimStatus, IdentityType, ItemStatus, ItemType, MatchStatus, UserType,
} from "./types";

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  LOST: "Barang Hilang",
  FOUND: "Barang Ditemukan",
};
export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  OPEN: "Terbuka",
  CLAIM_PENDING: "Menunggu verifikasi klaim",
  RETURNED: "Sudah dikembalikan",
  CLOSED: "Ditutup",
  REJECTED: "Ditolak admin",
};
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING: "Menunggu pemeriksaan",
  NEED_INFO: "Perlu bukti tambahan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};
export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SUGGESTED: "Disarankan",
  CONFIRMED: "Terkonfirmasi",
  DISMISSED: "Diabaikan",
};
export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  SUSPENDED: "Ditangguhkan",
};
export const USER_TYPE_LABEL: Record<UserType, string> = {
  STUDENT: "Mahasiswa",
  LECTURER: "Dosen",
  STAFF: "Staf",
};
export const IDENTITY_TYPE_LABEL: Record<IdentityType, string> = {
  NIM: "NIM",
  NIDN: "NIDN",
  NIP: "NIP",
  EMPLOYEE_ID: "ID Pegawai",
};

/** Jenis identitas yang diizinkan untuk tiap user_type (BR-04). */
export const IDENTITY_OPTIONS: Record<UserType, IdentityType[]> = {
  STUDENT: ["NIM"],
  LECTURER: ["NIDN", "EMPLOYEE_ID"],
  STAFF: ["NIP", "EMPLOYEE_ID"],
};
