import { config } from "@/lib/config";
import { exec, query, queryOne, withTransaction } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { recordStatusChange } from "@/modules/items/history";
import { runMatchingForItem } from "@/modules/matching/service";
import { notify } from "@/modules/notifications/service";
import type { ClaimStatus, ItemStatus, ItemType, SessionUser, UserType, IdentityType } from "@/lib/types";
import { CLAIM_STATUS_LABEL } from "@/lib/labels";

export class ClaimError extends Error {}

/*
 * Transisi status (lihat docs/ASSUMPTIONS.md untuk bagian yang tidak ditetapkan SKPL):
 *   ajukan klaim   : claim PENDING            | item OPEN -> CLAIM_PENDING   (BR-09)
 *   batalkan (user): PENDING -> CANCELLED     | item CLAIM_PENDING -> OPEN   (FR-28)
 *   admin setujui  : PENDING -> APPROVED      | item tetap CLAIM_PENDING sampai serah terima dikonfirmasi
 *   admin tolak    : PENDING -> REJECTED      | item CLAIM_PENDING -> OPEN
 *   admin minta info: PENDING -> NEED_INFO    | item tetap CLAIM_PENDING
 *   user lengkapi  : NEED_INFO -> PENDING     | (asumsi: SKPL tidak menetapkan alur balasan)
 *   serah terima   : claim APPROVED           | item CLAIM_PENDING -> RETURNED
 * Keunikan "satu klaim aktif per laporan" ditegakkan oleh kolom generated + UNIQUE di database.
 */

export interface ClaimRow {
  claim_id: number; item_id: number; claimant_id: number; reviewed_by: number | null;
  claim_note: string; evidence_url: string | null; claim_status: ClaimStatus; admin_note: string | null;
  submitted_at: string; reviewed_at: string | null;
}

const isDup = (e: unknown) => (e as { code?: string })?.code === "ER_DUP_ENTRY";

// ---------------------------------------------------------------- USER

export async function submitClaim(user: SessionUser, itemId: number, note: string, evidenceKey: string | null): Promise<number> {
  if (user.role !== "USER") throw new ClaimError("Hanya pengguna yang dapat mengajukan klaim."); // BR-06 (akun aktif dijamin sesi)
  return withTransaction(async (conn) => {
    const item = await queryOne<{ user_id: number; item_type: ItemType; item_status: ItemStatus; item_name: string }>(
      "SELECT user_id, item_type, item_status, item_name FROM items WHERE item_id = ? FOR UPDATE", [itemId], conn,
    );
    if (!item) throw new ClaimError("Laporan tidak ditemukan.");
    if (item.item_type !== "FOUND") throw new ClaimError("Klaim hanya dapat diajukan untuk laporan barang ditemukan.");
    if (item.user_id === user.userId) throw new ClaimError("Anda tidak dapat mengklaim laporan milik Anda sendiri.");
    if (item.item_status !== "OPEN") throw new ClaimError("Barang ini sedang tidak dapat diklaim karena statusnya bukan Terbuka."); // BR-09

    let claimId: number;
    try {
      const res = await exec(
        "INSERT INTO claims (item_id, claimant_id, claim_note, evidence_url, claim_status) VALUES (?, ?, ?, ?, 'PENDING')",
        [itemId, user.userId, note, evidenceKey], conn,
      );
      claimId = res.insertId;
    } catch (e) {
      if (isDup(e)) throw new ClaimError("Barang ini sedang diklaim oleh pengguna lain.");
      throw e;
    }
    await exec("UPDATE items SET item_status = 'CLAIM_PENDING' WHERE item_id = ?", [itemId], conn);
    await recordStatusChange(conn, itemId, user.userId, "OPEN", "CLAIM_PENDING", `Klaim #${claimId} diajukan`);
    await writeAudit(user.userId, "CLAIM_SUBMITTED", "claim", claimId, { itemId }, conn);
    await notify(conn, {
      userId: user.userId, itemId, claimId,
      title: "Klaim Anda diterima",
      message: `Klaim atas "${item.item_name}" sudah diajukan dan menunggu pemeriksaan admin.`,
    });
    await notify(conn, {
      userId: item.user_id, itemId, claimId: null,
      title: "Barang temuan Anda diklaim",
      message: `Seseorang mengajukan klaim atas laporan "${item.item_name}". Admin akan memeriksa bukti kepemilikan.`,
    });
    return claimId;
  });
}

/** FR-28: batalkan selama PENDING. Hanya pengaju yang boleh. */
export async function cancelClaim(user: SessionUser, claimId: number): Promise<void> {
  const itemId = await withTransaction(async (conn) => {
    const c = await queryOne<ClaimRow>("SELECT * FROM claims WHERE claim_id = ? FOR UPDATE", [claimId], conn);
    if (!c || c.claimant_id !== user.userId) throw new ClaimError("Klaim tidak ditemukan.");
    if (c.claim_status !== "PENDING") throw new ClaimError("Klaim hanya dapat dibatalkan selama berstatus Menunggu pemeriksaan.");
    await queryOne("SELECT item_id FROM items WHERE item_id = ? FOR UPDATE", [c.item_id], conn);
    await exec("UPDATE claims SET claim_status = 'CANCELLED' WHERE claim_id = ?", [claimId], conn);
    await exec("UPDATE items SET item_status = 'OPEN' WHERE item_id = ? AND item_status = 'CLAIM_PENDING'", [c.item_id], conn);
    await recordStatusChange(conn, c.item_id, user.userId, "CLAIM_PENDING", "OPEN", `Klaim #${claimId} dibatalkan pengaju`);
    await writeAudit(user.userId, "CLAIM_CANCELLED", "claim", claimId, { itemId: c.item_id }, conn);
    return c.item_id;
  });
  try { await runMatchingForItem(itemId); } catch (e) { console.error("[matching]", e); }
}

/** Asumsi: pengaju menanggapi permintaan bukti tambahan (NEED_INFO -> PENDING). */
export async function respondToNeedInfo(user: SessionUser, claimId: number, note: string, newEvidenceKey: string | null): Promise<{ oldEvidenceKey: string | null }> {
  return withTransaction(async (conn) => {
    const c = await queryOne<ClaimRow>("SELECT * FROM claims WHERE claim_id = ? FOR UPDATE", [claimId], conn);
    if (!c || c.claimant_id !== user.userId) throw new ClaimError("Klaim tidak ditemukan.");
    if (c.claim_status !== "NEED_INFO") throw new ClaimError("Klaim ini tidak sedang meminta bukti tambahan.");
    const stamp = new Date().toISOString().slice(0, 10);
    const merged = `${c.claim_note}\n\n[Informasi tambahan ${stamp}]\n${note}`;
    if (merged.length > 20000) throw new ClaimError("Catatan klaim sudah terlalu panjang.");
    await exec(
      "UPDATE claims SET claim_note = ?, evidence_url = ?, claim_status = 'PENDING' WHERE claim_id = ?",
      [merged, newEvidenceKey ?? c.evidence_url, claimId], conn,
    );
    await writeAudit(user.userId, "CLAIM_INFO_PROVIDED", "claim", claimId, { itemId: c.item_id }, conn);
    return { oldEvidenceKey: newEvidenceKey && c.evidence_url ? c.evidence_url : null };
  });
}

export interface UserClaimView {
  claimId: number; itemId: number; itemName: string; itemType: ItemType; itemStatus: ItemStatus;
  claimStatus: ClaimStatus; claimNote: string; hasEvidence: boolean; adminNote: string | null;
  submittedAt: string; reviewedAt: string | null;
}

/** FR-29: riwayat klaim milik pengguna (catatan admin ikut tampil sebagai hasil pemeriksaan). */
export async function listClaimsForUser(userId: number): Promise<UserClaimView[]> {
  const rows = await query<ClaimRow & { item_name: string; item_type: ItemType; item_status: ItemStatus }>(
    `SELECT c.*, i.item_name, i.item_type, i.item_status
       FROM claims c JOIN items i ON i.item_id = c.item_id
      WHERE c.claimant_id = ? ORDER BY c.submitted_at DESC, c.claim_id DESC`,
    [userId],
  );
  return rows.map((r) => ({
    claimId: r.claim_id, itemId: r.item_id, itemName: r.item_name, itemType: r.item_type, itemStatus: r.item_status,
    claimStatus: r.claim_status, claimNote: r.claim_note, hasEvidence: !!r.evidence_url, adminNote: r.admin_note,
    submittedAt: r.submitted_at, reviewedAt: r.reviewed_at,
  }));
}

export async function getUserClaim(userId: number, claimId: number): Promise<UserClaimView | null> {
  return (await listClaimsForUser(userId)).find((c) => c.claimId === claimId) ?? null;
}

/** Status klaim aktif milik pengguna pada sebuah laporan (untuk tombol di halaman detail). */
export async function getMyClaimOnItem(userId: number, itemId: number) {
  return queryOne<{ claim_id: number; claim_status: ClaimStatus }>(
    "SELECT claim_id, claim_status FROM claims WHERE item_id = ? AND claimant_id = ? ORDER BY claim_id DESC LIMIT 1",
    [itemId, userId],
  );
}

// ---------------------------------------------------------------- ADMIN

export interface AdminClaimListRow {
  claimId: number; itemId: number; itemName: string; claimantName: string; claimantType: UserType | null;
  claimStatus: ClaimStatus; submittedAt: string; reviewedAt: string | null;
}

/** FR-19: daftar klaim untuk ADMIN. */
export async function listClaimsForAdmin(admin: SessionUser, opts: { status?: ClaimStatus; q?: string; page?: number }) {
  if (admin.role !== "ADMIN") throw new ClaimError("Tidak berwenang.");
  const where: string[] = []; const params: unknown[] = [];
  if (opts.status) { where.push("c.claim_status = ?"); params.push(opts.status); }
  if (opts.q) {
    const like = `%${opts.q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    where.push("(i.item_name LIKE ? OR u.full_name LIKE ?)"); params.push(like, like);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, opts.page ?? 1);
  const [{ total }] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM claims c JOIN items i ON i.item_id=c.item_id JOIN users u ON u.user_id=c.claimant_id ${w}`, params);
  const rows = await query<ClaimRow & { item_name: string; full_name: string; user_type: UserType | null }>(
    `SELECT c.*, i.item_name, u.full_name, u.user_type
       FROM claims c JOIN items i ON i.item_id = c.item_id JOIN users u ON u.user_id = c.claimant_id
       ${w}
      ORDER BY FIELD(c.claim_status,'PENDING','NEED_INFO','APPROVED','REJECTED','CANCELLED'), c.submitted_at ASC
      LIMIT ? OFFSET ?`,
    [...params, config.pageSize, (page - 1) * config.pageSize],
  );
  const list: AdminClaimListRow[] = rows.map((r) => ({
    claimId: r.claim_id, itemId: r.item_id, itemName: r.item_name, claimantName: r.full_name, claimantType: r.user_type,
    claimStatus: r.claim_status, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at,
  }));
  return { rows: list, total, page, pageCount: Math.max(1, Math.ceil(total / config.pageSize)) };
}

export interface AdminClaimDetail {
  claimId: number; claimStatus: ClaimStatus; claimNote: string; adminNote: string | null; hasEvidence: boolean;
  submittedAt: string; reviewedAt: string | null; reviewerName: string | null;
  claimant: { userId: number; fullName: string; email: string; phone: string | null; userType: UserType | null;
    identityType: IdentityType | null; identityNumber: string | null };
  item: { itemId: number; itemName: string; itemStatus: ItemStatus; categoryName: string; locationName: string;
    color: string | null; description: string | null; incidentDate: string; privateIdentifier: string | null; hasPhoto: boolean;
    reporterName: string };
}

/** FR-19: detail klaim lengkap (termasuk ciri khusus rahasia laporan) — HANYA untuk ADMIN. */
export async function getClaimForAdmin(admin: SessionUser, claimId: number): Promise<AdminClaimDetail | null> {
  if (admin.role !== "ADMIN") throw new ClaimError("Tidak berwenang.");
  const r = await queryOne<Record<string, unknown>>(
    `SELECT c.claim_id, c.claim_status, c.claim_note, c.admin_note, c.evidence_url, c.submitted_at, c.reviewed_at,
            rv.full_name AS reviewer_name,
            u.user_id, u.full_name, u.email, u.phone_number, u.user_type, u.identity_type, u.identity_number,
            i.item_id, i.item_name, i.item_status, i.color, i.description, i.incident_date, i.private_identifier,
            (i.photo_url IS NOT NULL) AS has_photo, cat.category_name, loc.location_name, rep.full_name AS reporter_name
       FROM claims c
       JOIN users u ON u.user_id = c.claimant_id
       JOIN items i ON i.item_id = c.item_id
       JOIN users rep ON rep.user_id = i.user_id
       JOIN categories cat ON cat.category_id = i.category_id
       JOIN locations loc ON loc.location_id = i.location_id
       LEFT JOIN users rv ON rv.user_id = c.reviewed_by
      WHERE c.claim_id = ?`,
    [claimId],
  );
  if (!r) return null;
  return {
    claimId: r.claim_id as number, claimStatus: r.claim_status as ClaimStatus, claimNote: r.claim_note as string,
    adminNote: r.admin_note as string | null, hasEvidence: !!r.evidence_url, submittedAt: r.submitted_at as string,
    reviewedAt: r.reviewed_at as string | null, reviewerName: r.reviewer_name as string | null,
    claimant: {
      userId: r.user_id as number, fullName: r.full_name as string, email: r.email as string,
      phone: r.phone_number as string | null, userType: r.user_type as UserType | null,
      identityType: r.identity_type as IdentityType | null, identityNumber: r.identity_number as string | null,
    },
    item: {
      itemId: r.item_id as number, itemName: r.item_name as string, itemStatus: r.item_status as ItemStatus,
      categoryName: r.category_name as string, locationName: r.location_name as string, color: r.color as string | null,
      description: r.description as string | null, incidentDate: r.incident_date as string,
      privateIdentifier: r.private_identifier as string | null, hasPhoto: !!r.has_photo, reporterName: r.reporter_name as string,
    },
  };
}

/** FR-20 + BR-07: hanya ADMIN yang memutuskan klaim; hanya klaim PENDING yang dapat diputuskan. */
export async function decideClaim(
  admin: SessionUser, claimId: number, decision: "APPROVED" | "REJECTED" | "NEED_INFO", adminNote: string | null,
): Promise<void> {
  if (admin.role !== "ADMIN") throw new ClaimError("Hanya administrator yang dapat memutuskan klaim.");
  // Penegakan di service (bukan hanya di form): penolakan/permintaan info wajib disertai alasan yang jelas.
  if ((decision === "REJECTED" || decision === "NEED_INFO") && (!adminNote || adminNote.trim().length < 10))
    throw new ClaimError("Catatan admin wajib diisi (minimal 10 karakter) untuk keputusan ini.");
  const reopenedItemId = await withTransaction(async (conn) => {
    const c = await queryOne<ClaimRow>("SELECT * FROM claims WHERE claim_id = ? FOR UPDATE", [claimId], conn);
    if (!c) throw new ClaimError("Klaim tidak ditemukan.");
    if (c.claim_status !== "PENDING")
      throw new ClaimError(`Klaim berstatus "${CLAIM_STATUS_LABEL[c.claim_status]}" sehingga tidak dapat diputuskan sekarang.`);
    const item = await queryOne<{ user_id: number; item_name: string; item_status: ItemStatus }>(
      "SELECT user_id, item_name, item_status FROM items WHERE item_id = ? FOR UPDATE", [c.item_id], conn,
    );
    if (!item) throw new ClaimError("Laporan terkait tidak ditemukan.");

    await exec(
      "UPDATE claims SET claim_status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE claim_id = ?",
      [decision, adminNote, admin.userId, claimId], conn,
    );
    await writeAudit(admin.userId, "CLAIM_DECISION", "claim", claimId, { decision, itemId: c.item_id, note: adminNote }, conn);

    let reopened: number | null = null;
    if (decision === "APPROVED") {
      // Rekomendasi milik pengaju untuk barang ini dikonfirmasi.
      await exec(
        `UPDATE item_matches m JOIN items l ON l.item_id = m.lost_item_id
            SET m.match_status = 'CONFIRMED'
          WHERE m.found_item_id = ? AND l.user_id = ?`,
        [c.item_id, c.claimant_id], conn,
      );
      await notify(conn, {
        userId: c.claimant_id, itemId: c.item_id, claimId,
        title: "Klaim Anda disetujui",
        message: `Klaim atas "${item.item_name}" disetujui. Silakan ikuti prosedur serah terima barang yang ditetapkan kampus.${adminNote ? ` Catatan admin: ${adminNote}` : ""}`,
      });
      await notify(conn, {
        userId: item.user_id, itemId: c.item_id,
        title: "Klaim atas barang temuan Anda disetujui",
        message: `Klaim atas "${item.item_name}" telah disetujui admin. Menunggu serah terima barang.`,
      });
    } else if (decision === "REJECTED") {
      await exec("UPDATE items SET item_status = 'OPEN' WHERE item_id = ? AND item_status = 'CLAIM_PENDING'", [c.item_id], conn);
      await recordStatusChange(conn, c.item_id, admin.userId, "CLAIM_PENDING", "OPEN", `Klaim #${claimId} ditolak; laporan dibuka kembali`);
      await notify(conn, {
        userId: c.claimant_id, itemId: c.item_id, claimId,
        title: "Klaim Anda ditolak",
        message: `Klaim atas "${item.item_name}" ditolak. Alasan: ${adminNote}`,
      });
      reopened = c.item_id;
    } else {
      await notify(conn, {
        userId: c.claimant_id, itemId: c.item_id, claimId,
        title: "Admin meminta bukti tambahan",
        message: `Untuk memproses klaim atas "${item.item_name}", admin membutuhkan informasi tambahan: ${adminNote}`,
      });
    }
    return reopened;
  });
  if (reopenedItemId) { try { await runMatchingForItem(reopenedItemId); } catch (e) { console.error("[matching]", e); } }
}

/** Serah terima dikonfirmasi ADMIN: klaim APPROVED -> item RETURNED (SKPL: "RETURNED setelah serah terima dikonfirmasi"). */
export async function confirmHandover(admin: SessionUser, claimId: number): Promise<void> {
  if (admin.role !== "ADMIN") throw new ClaimError("Hanya administrator yang dapat mengonfirmasi serah terima.");
  await withTransaction(async (conn) => {
    const c = await queryOne<ClaimRow>("SELECT * FROM claims WHERE claim_id = ? FOR UPDATE", [claimId], conn);
    if (!c) throw new ClaimError("Klaim tidak ditemukan.");
    if (c.claim_status !== "APPROVED") throw new ClaimError("Serah terima hanya dapat dikonfirmasi untuk klaim yang sudah disetujui.");
    const item = await queryOne<{ user_id: number; item_name: string; item_status: ItemStatus }>(
      "SELECT user_id, item_name, item_status FROM items WHERE item_id = ? FOR UPDATE", [c.item_id], conn,
    );
    if (!item) throw new ClaimError("Laporan terkait tidak ditemukan.");
    if (item.item_status === "RETURNED") throw new ClaimError("Barang ini sudah tercatat dikembalikan.");
    await exec("UPDATE items SET item_status = 'RETURNED' WHERE item_id = ?", [c.item_id], conn);
    await recordStatusChange(conn, c.item_id, admin.userId, item.item_status, "RETURNED", `Serah terima klaim #${claimId} dikonfirmasi`);
    await writeAudit(admin.userId, "ITEM_RETURNED", "item", c.item_id, { claimId }, conn);
    await notify(conn, { userId: c.claimant_id, itemId: c.item_id, claimId,
      title: "Serah terima barang tercatat", message: `Barang "${item.item_name}" tercatat sudah diserahkan kepada Anda.` });
    await notify(conn, { userId: item.user_id, itemId: c.item_id,
      title: "Barang temuan Anda sudah dikembalikan", message: `Laporan "${item.item_name}" selesai: barang telah dikembalikan kepada pemiliknya. Terima kasih!` });
  });
}

/** Berkas bukti: hanya pengaju atau ADMIN (FR-33, NFR-03). */
export async function getEvidenceKeyFor(user: SessionUser, claimId: number): Promise<string | null> {
  const c = await queryOne<{ claimant_id: number; evidence_url: string | null }>(
    "SELECT claimant_id, evidence_url FROM claims WHERE claim_id = ?", [claimId],
  );
  if (!c) return null;
  if (user.role === "ADMIN" || c.claimant_id === user.userId) return c.evidence_url;
  return null;
}

/** Klaim pada satu laporan (untuk halaman moderasi ADMIN). */
export async function listClaimsForItem(admin: SessionUser, itemId: number) {
  if (admin.role !== "ADMIN") throw new ClaimError("Tidak berwenang.");
  return query<{ claim_id: number; claim_status: ClaimStatus; full_name: string; submitted_at: string }>(
    `SELECT c.claim_id, c.claim_status, u.full_name, c.submitted_at
       FROM claims c JOIN users u ON u.user_id = c.claimant_id WHERE c.item_id = ? ORDER BY c.claim_id DESC`,
    [itemId],
  );
}
