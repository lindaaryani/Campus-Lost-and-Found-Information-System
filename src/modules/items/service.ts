import { config } from "@/lib/config";
import { exec, query, queryOne, withTransaction } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { escapeLike, truncate } from "@/lib/utils";
import { runMatchingForItem } from "@/modules/matching/service";
import { notify } from "@/modules/notifications/service";
import { recordStatusChange } from "./history";
import type { HistoryEntry, ItemCard, ItemDetail, ItemFilters } from "./types";
import type { ItemStatus, ItemType, SessionUser, UserType } from "@/lib/types";
import { ITEM_STATUS_LABEL, USER_TYPE_LABEL } from "@/lib/labels";

export class ItemError extends Error {}

/** Status laporan yang boleh dilihat pengguna biasa selain pemiliknya. */
const PUBLIC_STATUSES: ItemStatus[] = ["OPEN", "CLAIM_PENDING", "RETURNED"];

// ---------------------------------------------------------------- daftar & pencarian (FR-11)

interface CardRow {
  item_id: number; item_type: ItemType; item_name: string; category_name: string; location_name: string;
  color: string | null; incident_date: string; has_photo: number; item_status: ItemStatus;
  created_at: string; description: string | null; reporter_name?: string;
}

const mapCard = (r: CardRow): ItemCard => ({
  itemId: r.item_id, itemType: r.item_type, itemName: r.item_name, categoryName: r.category_name,
  locationName: r.location_name, color: r.color, incidentDate: r.incident_date, hasPhoto: !!r.has_photo,
  itemStatus: r.item_status, createdAt: r.created_at, descriptionSnippet: truncate(r.description, 110) || null,
  ...(r.reporter_name !== undefined ? { reporterName: r.reporter_name } : {}),
});

export type ListScope = "public" | "mine" | "admin";

/**
 * Daftar laporan dengan filter + pagination (NFR-05).
 * Query daftar TIDAK PERNAH memilih kolom private_identifier.
 *  - public: hanya status OPEN/CLAIM_PENDING/RETURNED (laporan REJECTED/CLOSED tidak tampil ke orang lain)
 *  - mine  : seluruh laporan milik `viewer`
 *  - admin : semua laporan + nama pelapor
 */
export async function listItems(scope: ListScope, viewer: SessionUser, f: ItemFilters) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (scope === "mine") { where.push("i.user_id = ?"); params.push(viewer.userId); }
  if (scope === "public") where.push(`i.item_status IN (${PUBLIC_STATUSES.map((s) => `'${s}'`).join(",")})`);
  if (scope === "admin" && viewer.role !== "ADMIN") throw new ItemError("Tidak berwenang.");

  if (f.type) { where.push("i.item_type = ?"); params.push(f.type); }
  if (f.categoryId) { where.push("i.category_id = ?"); params.push(f.categoryId); }
  if (f.locationId) { where.push("i.location_id = ?"); params.push(f.locationId); }
  if (f.status) { where.push("i.item_status = ?"); params.push(f.status); }
  if (f.dateFrom) { where.push("i.incident_date >= ?"); params.push(f.dateFrom); }
  if (f.dateTo) { where.push("i.incident_date <= ?"); params.push(f.dateTo); }
  if (f.q) {
    for (const w of f.q.trim().split(/\s+/).slice(0, 5)) {
      const like = `%${escapeLike(w)}%`;
      where.push("(i.item_name LIKE ? OR i.description LIKE ? OR i.color LIKE ?)");
      params.push(like, like, like);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, f.page ?? 1);
  const adminCols = scope === "admin" ? ", u.full_name AS reporter_name" : "";
  const adminJoin = scope === "admin" ? "JOIN users u ON u.user_id = i.user_id" : "";

  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM items i ${whereSql}`, params);
  const rows = await query<CardRow>(
    `SELECT i.item_id, i.item_type, i.item_name, c.category_name, l.location_name, i.color, i.incident_date,
            (i.photo_url IS NOT NULL) AS has_photo, i.item_status, i.created_at, i.description ${adminCols}
       FROM items i
       JOIN categories c ON c.category_id = i.category_id
       JOIN locations l ON l.location_id = i.location_id
       ${adminJoin}
       ${whereSql}
      ORDER BY i.created_at DESC, i.item_id DESC
      LIMIT ? OFFSET ?`,
    [...params, config.pageSize, (page - 1) * config.pageSize],
  );
  return { items: rows.map(mapCard), total, page, pageCount: Math.max(1, Math.ceil(total / config.pageSize)) };
}

// ---------------------------------------------------------------- detail (FR-12, FR-33)

interface DetailRow extends CardRow {
  user_id: number; category_id: number; location_id: number; private_identifier: string | null;
  updated_at: string; reporter_type: UserType | null; reporter_full_name: string; reporter_email: string;
}

/**
 * Detail laporan dengan proyeksi menurut peran penampil.
 * Mengembalikan null bila laporan tidak ada ATAU tidak boleh dilihat penampil (tidak membocorkan keberadaannya).
 */
export async function getItemDetail(itemId: number, viewer: SessionUser): Promise<ItemDetail | null> {
  const r = await queryOne<DetailRow>(
    `SELECT i.item_id, i.user_id, i.item_type, i.item_name, i.category_id, c.category_name, i.location_id,
            l.location_name, i.color, i.description, i.incident_date, (i.photo_url IS NOT NULL) AS has_photo,
            i.private_identifier, i.item_status, i.created_at, i.updated_at,
            u.user_type AS reporter_type, u.full_name AS reporter_full_name, u.email AS reporter_email
       FROM items i
       JOIN categories c ON c.category_id = i.category_id
       JOIN locations l ON l.location_id = i.location_id
       JOIN users u ON u.user_id = i.user_id
      WHERE i.item_id = ?`,
    [itemId],
  );
  if (!r) return null;
  const isAdmin = viewer.role === "ADMIN";
  const isOwner = r.user_id === viewer.userId;
  if (!isAdmin && !isOwner && !PUBLIC_STATUSES.includes(r.item_status)) return null;

  const privileged = isAdmin || isOwner;
  return {
    ...mapCard(r),
    userId: privileged ? r.user_id : null,
    categoryId: r.category_id,
    locationId: r.location_id,
    description: r.description,
    isOwner,
    privateIdentifier: privileged ? r.private_identifier : null, // <- satu-satunya jalur ke klien
    reporterLabel: r.reporter_type ? USER_TYPE_LABEL[r.reporter_type] : "Administrator",
    reporterName: isAdmin ? r.reporter_full_name : null,
    reporterEmail: isAdmin ? r.reporter_email : null,
    updatedAt: r.updated_at,
  };
}

/** Riwayat status (FR-31). Nama pelaku hanya untuk ADMIN; pemilik melihat "Anda"/"Admin". */
export async function getItemHistory(itemId: number, viewer: SessionUser): Promise<HistoryEntry[]> {
  const rows = await query<{
    history_id: number; old_status: string | null; new_status: string; change_note: string | null;
    changed_at: string; changed_by: number; full_name: string; role: string;
  }>(
    `SELECT h.history_id, h.old_status, h.new_status, h.change_note, h.changed_at, h.changed_by, u.full_name, u.role
       FROM item_status_histories h JOIN users u ON u.user_id = h.changed_by
      WHERE h.item_id = ? ORDER BY h.changed_at ASC, h.history_id ASC`,
    [itemId],
  );
  return rows.map((h) => ({
    historyId: h.history_id, oldStatus: h.old_status, newStatus: h.new_status, note: h.change_note, changedAt: h.changed_at,
    actor: viewer.role === "ADMIN" ? `${h.full_name} (${h.role === "ADMIN" ? "Admin" : "Pengguna"})`
      : h.changed_by === viewer.userId ? "Anda" : h.role === "ADMIN" ? "Admin" : "Pengguna lain",
  }));
}

// ---------------------------------------------------------------- pembuatan & pembaruan (FR-08/09/10)

export interface ItemInput {
  itemType: ItemType; itemName: string; categoryId: number; locationId: number; color: string;
  description: string; incidentDate: string; privateIdentifier: string | null;
}

async function assertActiveMaster(categoryId: number, locationId: number) {
  const c = await queryOne("SELECT 1 FROM categories WHERE category_id = ? AND is_active = 1", [categoryId]);
  if (!c) throw new ItemError("Kategori tidak tersedia. Pilih kategori yang aktif.");
  const l = await queryOne("SELECT 1 FROM locations WHERE location_id = ? AND is_active = 1", [locationId]);
  if (!l) throw new ItemError("Lokasi tidak tersedia. Pilih lokasi yang aktif.");
}

export async function createItem(user: SessionUser, input: ItemInput, photoKey: string | null): Promise<number> {
  if (user.role !== "USER" || user.accountStatus !== "ACTIVE") throw new ItemError("Hanya pengguna aktif yang dapat membuat laporan."); // BR-06
  await assertActiveMaster(input.categoryId, input.locationId);

  const itemId = await withTransaction(async (conn) => {
    const res = await exec(
      `INSERT INTO items (user_id, category_id, location_id, item_type, item_name, color, description,
                          incident_date, photo_url, private_identifier, item_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [user.userId, input.categoryId, input.locationId, input.itemType, input.itemName, input.color,
        input.description, input.incidentDate, photoKey, input.privateIdentifier],
      conn,
    );
    const id = res.insertId;
    await recordStatusChange(conn, id, user.userId, null, "OPEN", "Laporan dibuat");
    await writeAudit(user.userId, "ITEM_CREATED", "item", id, { type: input.itemType }, conn);
    return id;
  });

  // Pencocokan dijalankan setelah commit: kegagalan matching tidak boleh menggagalkan laporan.
  try { await runMatchingForItem(itemId); } catch (e) { console.error("[matching] gagal untuk item", itemId, e); }
  return itemId;
}

/** Pemilik memperbarui laporannya selama masih OPEN. Mengembalikan kunci foto lama yang harus dihapus (bila diganti). */
export async function updateItem(
  user: SessionUser, itemId: number, input: Omit<ItemInput, "itemType">,
  opts: { newPhotoKey: string | null; removePhoto: boolean },
): Promise<{ oldPhotoKey: string | null }> {
  await assertActiveMaster(input.categoryId, input.locationId);
  const oldPhotoKey = await withTransaction(async (conn) => {
    const cur = await queryOne<{ user_id: number; item_status: ItemStatus; photo_url: string | null }>(
      "SELECT user_id, item_status, photo_url FROM items WHERE item_id = ? FOR UPDATE", [itemId], conn,
    );
    if (!cur || cur.user_id !== user.userId) throw new ItemError("Laporan tidak ditemukan.");
    if (cur.item_status !== "OPEN") throw new ItemError("Laporan hanya dapat diubah selama berstatus Terbuka.");
    const photo = opts.newPhotoKey ?? (opts.removePhoto ? null : cur.photo_url);
    await exec(
      `UPDATE items SET category_id = ?, location_id = ?, item_name = ?, color = ?, description = ?,
              incident_date = ?, private_identifier = ?, photo_url = ? WHERE item_id = ?`,
      [input.categoryId, input.locationId, input.itemName, input.color, input.description,
        input.incidentDate, input.privateIdentifier, photo, itemId], conn,
    );
    await writeAudit(user.userId, "ITEM_UPDATED", "item", itemId, null, conn);
    return photo !== cur.photo_url ? cur.photo_url : null;
  });
  try { await runMatchingForItem(itemId); } catch (e) { console.error("[matching] gagal untuk item", itemId, e); }
  return { oldPhotoKey };
}

/** Pemilik menutup laporannya sendiri (OPEN -> CLOSED), mis. barang sudah ketemu. */
export async function closeOwnItem(user: SessionUser, itemId: number): Promise<void> {
  await withTransaction(async (conn) => {
    const cur = await queryOne<{ user_id: number; item_status: ItemStatus }>(
      "SELECT user_id, item_status FROM items WHERE item_id = ? FOR UPDATE", [itemId], conn,
    );
    if (!cur || cur.user_id !== user.userId) throw new ItemError("Laporan tidak ditemukan.");
    if (cur.item_status !== "OPEN") throw new ItemError("Hanya laporan berstatus Terbuka yang dapat ditutup.");
    await exec("UPDATE items SET item_status = 'CLOSED' WHERE item_id = ?", [itemId], conn);
    await recordStatusChange(conn, itemId, user.userId, "OPEN", "CLOSED", "Ditutup oleh pelapor");
    await writeAudit(user.userId, "ITEM_STATUS_CHANGED", "item", itemId, { from: "OPEN", to: "CLOSED", by: "owner" }, conn);
  });
}

// ---------------------------------------------------------------- moderasi ADMIN (FR-23)

/**
 * ADMIN memoderasi status laporan: OPEN <-> CLOSED <-> REJECTED.
 * Laporan CLAIM_PENDING harus diselesaikan lewat alur klaim; RETURNED bersifat final.
 */
export async function adminChangeItemStatus(
  admin: SessionUser, itemId: number, newStatus: "OPEN" | "CLOSED" | "REJECTED", note: string,
): Promise<void> {
  if (admin.role !== "ADMIN") throw new ItemError("Hanya administrator yang dapat memoderasi laporan.");
  await withTransaction(async (conn) => {
    const cur = await queryOne<{ user_id: number; item_status: ItemStatus; item_name: string }>(
      "SELECT user_id, item_status, item_name FROM items WHERE item_id = ? FOR UPDATE", [itemId], conn,
    );
    if (!cur) throw new ItemError("Laporan tidak ditemukan.");
    if (cur.item_status === "CLAIM_PENDING")
      throw new ItemError("Laporan sedang memiliki klaim aktif. Selesaikan klaim terlebih dahulu di menu Verifikasi Klaim.");
    if (cur.item_status === "RETURNED") throw new ItemError("Laporan yang sudah dikembalikan tidak dapat diubah lagi.");
    if (cur.item_status === newStatus) throw new ItemError("Laporan sudah berstatus tersebut.");

    await exec("UPDATE items SET item_status = ? WHERE item_id = ?", [newStatus, itemId], conn);
    await recordStatusChange(conn, itemId, admin.userId, cur.item_status, newStatus, note);
    await writeAudit(admin.userId, "ITEM_STATUS_CHANGED", "item", itemId, { from: cur.item_status, to: newStatus, note }, conn);
    await notify(conn, {
      userId: cur.user_id, itemId,
      title: "Status laporan Anda berubah",
      message: `Laporan "${cur.item_name}" diubah dari "${ITEM_STATUS_LABEL[cur.item_status]}" menjadi "${ITEM_STATUS_LABEL[newStatus]}". Alasan: ${note}`,
    });
  });
  if (newStatus === "OPEN") {
    try { await runMatchingForItem(itemId); } catch (e) { console.error("[matching]", e); }
  }
}

// ---------------------------------------------------------------- bantuan form

export async function getMasterOptions(includeInactiveIds: { categoryId?: number; locationId?: number } = {}) {
  const categories = await query<{ category_id: number; category_name: string }>(
    "SELECT category_id, category_name FROM categories WHERE is_active = 1 OR category_id = ? ORDER BY category_name",
    [includeInactiveIds.categoryId ?? 0],
  );
  const locations = await query<{ location_id: number; location_name: string }>(
    "SELECT location_id, location_name FROM locations WHERE is_active = 1 OR location_id = ? ORDER BY location_name",
    [includeInactiveIds.locationId ?? 0],
  );
  return {
    categories: categories.map((c) => ({ id: c.category_id, name: c.category_name })),
    locations: locations.map((l) => ({ id: l.location_id, name: l.location_name })),
  };
}

export async function getPhotoKey(itemId: number): Promise<{ key: string | null; ownerId: number; status: ItemStatus } | null> {
  const r = await queryOne<{ photo_url: string | null; user_id: number; item_status: ItemStatus }>(
    "SELECT photo_url, user_id, item_status FROM items WHERE item_id = ?", [itemId],
  );
  return r ? { key: r.photo_url, ownerId: r.user_id, status: r.item_status } : null;
}

