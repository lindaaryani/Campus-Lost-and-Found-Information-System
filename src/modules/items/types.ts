import type { ItemStatus, ItemType, UserType } from "@/lib/types";

/** Kartu/baris daftar laporan: hanya kolom yang aman ditampilkan ke pengguna terautentikasi mana pun. */
export interface ItemCard {
  itemId: number;
  itemType: ItemType;
  itemName: string;
  categoryName: string;
  locationName: string;
  color: string | null;
  incidentDate: string;
  hasPhoto: boolean;
  itemStatus: ItemStatus;
  createdAt: string;
  descriptionSnippet: string | null;
  /** Hanya terisi pada daftar milik ADMIN. */
  reporterName?: string;
}

/**
 * Detail laporan. `privateIdentifier` HANYA terisi untuk pemilik laporan dan ADMIN (FR-12, FR-33, BR-11).
 * Untuk pengguna lain nilainya SELALU null; kolom tidak pernah dikirim ke klien.
 */
export interface ItemDetail extends Omit<ItemCard, "reporterName"> {
  userId: number | null; // hanya diisi untuk pemilik/admin
  categoryId: number;
  locationId: number;
  description: string | null;
  isOwner: boolean;
  privateIdentifier: string | null;
  reporterLabel: string; // "Mahasiswa" | "Dosen" | "Staf" — tanpa nama untuk pengguna lain
  reporterName: string | null; // admin saja
  reporterEmail: string | null; // admin saja
  updatedAt: string;
}

export interface ItemFilters {
  q?: string;
  type?: ItemType;
  categoryId?: number;
  locationId?: number;
  status?: ItemStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

export interface HistoryEntry {
  historyId: number;
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  changedAt: string;
  actor: string;
}

export type { UserType };
