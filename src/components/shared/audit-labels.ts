/** Label Indonesia untuk kode aktivitas audit (audit_logs.action). */
export const ACTION_LABEL: Record<string, string> = {
  USER_REGISTERED: "Pengguna mendaftar",
  ITEM_CREATED: "Laporan dibuat",
  ITEM_UPDATED: "Laporan diperbarui",
  ITEM_STATUS_CHANGED: "Status laporan berubah",
  ITEM_RETURNED: "Barang dikembalikan",
  CLAIM_SUBMITTED: "Klaim diajukan",
  CLAIM_CANCELLED: "Klaim dibatalkan",
  CLAIM_INFO_PROVIDED: "Pengaju melengkapi bukti",
  CLAIM_DECISION: "Keputusan klaim",
  USER_STATUS_CHANGED: "Status akun diubah",
  MASTER_CREATED: "Data master ditambahkan",
  MASTER_UPDATED: "Data master diubah",
  MASTER_ACTIVATED: "Data master diaktifkan",
  MASTER_DEACTIVATED: "Data master dinonaktifkan",
};
export const ENTITY_LABEL: Record<string, string> = { item: "Laporan", claim: "Klaim", user: "Pengguna", category: "Kategori", location: "Lokasi" };
