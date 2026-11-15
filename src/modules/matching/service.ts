import { config } from "@/lib/config";
import { exec, query, queryOne, withTransaction } from "@/lib/db";
import { notify } from "@/modules/notifications/service";
import { computeSimilarity, type Matchable } from "./scoring";
import type { ItemStatus, ItemType, MatchStatus } from "@/lib/types";

interface ItemRow {
  item_id: number; user_id: number; item_type: ItemType; item_status: ItemStatus;
  category_id: number; location_id: number; color: string | null;
  incident_date: string; item_name: string; description: string | null;
}

const toMatchable = (r: ItemRow): Matchable => ({
  categoryId: r.category_id, locationId: r.location_id, color: r.color,
  incidentDate: r.incident_date, itemName: r.item_name, description: r.description,
});

const ITEM_COLS = `item_id, user_id, item_type, item_status, category_id, location_id, color,
                   incident_date, item_name, description`;

/**
 * FR-13/14/15: dipanggil setelah laporan LOST/FOUND disimpan atau diperbarui.
 *  - hanya laporan berstatus OPEN yang ikut dicocokkan (eligibility),
 *  - kandidat = laporan bertipe berlawanan, OPEN, dari pengguna lain,
 *  - pasangan dengan skor >= threshold disimpan di item_matches (upsert; status DISMISSED/CONFIRMED dipertahankan),
 *  - pasangan SUGGESTED yang skornya jatuh di bawah threshold setelah pembaruan dihapus,
 *  - kedua pemilik diberi notifikasi HANYA saat pasangan baru terbentuk.
 * Skor hanyalah rekomendasi, bukan bukti kepemilikan (BR-10).
 */
export async function runMatchingForItem(itemId: number): Promise<{ created: number; updated: number; removed: number }> {
  const item = await queryOne<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE item_id = ?`, [itemId]);
  const result = { created: 0, updated: 0, removed: 0 };
  if (!item || item.item_status !== "OPEN") return result;

  const opposite: ItemType = item.item_type === "LOST" ? "FOUND" : "LOST";
  const candidates = await query<ItemRow>(
    `SELECT ${ITEM_COLS} FROM items
      WHERE item_type = ? AND item_status = 'OPEN' AND user_id <> ?
      ORDER BY incident_date DESC LIMIT 1000`,
    [opposite, item.user_id],
  );
  if (candidates.length === 0) return result;

  await withTransaction(async (conn) => {
    const existing = await query<{ match_id: number; lost_item_id: number; found_item_id: number; match_status: MatchStatus }>(
      "SELECT match_id, lost_item_id, found_item_id, match_status FROM item_matches WHERE lost_item_id = ? OR found_item_id = ?",
      [itemId, itemId], conn,
    );
    const byPair = new Map(existing.map((m) => [`${m.lost_item_id}:${m.found_item_id}`, m]));

    for (const cand of candidates) {
      const lost = item.item_type === "LOST" ? item : cand;
      const found = item.item_type === "FOUND" ? item : cand;
      const score = computeSimilarity(toMatchable(lost), toMatchable(found), config.matchDateWindowDays).total;
      const key = `${lost.item_id}:${found.item_id}`;
      const prev = byPair.get(key);

      if (score >= config.matchThreshold) {
        if (prev) {
          await exec("UPDATE item_matches SET similarity_score = ?, matched_at = UTC_TIMESTAMP() WHERE match_id = ?", [score, prev.match_id], conn);
          result.updated++;
        } else {
          await exec(
            "INSERT INTO item_matches (lost_item_id, found_item_id, similarity_score, match_status) VALUES (?, ?, ?, 'SUGGESTED')",
            [lost.item_id, found.item_id, score], conn,
          );
          result.created++;
          const pct = `${score.toFixed(0)}%`;
          await notify(conn, {
            userId: lost.user_id, itemId: lost.item_id,
            title: "Kemungkinan barang Anda ditemukan",
            message: `Laporan temuan "${found.item_name}" memiliki kemiripan ${pct} dengan laporan kehilangan Anda "${lost.item_name}". Skor ini hanya rekomendasi, bukan bukti kepemilikan.`,
          });
          await notify(conn, {
            userId: found.user_id, itemId: found.item_id,
            title: "Ada laporan kehilangan yang mirip",
            message: `Laporan kehilangan "${lost.item_name}" memiliki kemiripan ${pct} dengan barang temuan Anda "${found.item_name}".`,
          });
        }
      } else if (prev && prev.match_status === "SUGGESTED") {
        await exec("DELETE FROM item_matches WHERE match_id = ?", [prev.match_id], conn);
        result.removed++;
      }
    }
  });
  return result;
}

export interface MatchView {
  matchId: number;
  score: number;
  status: MatchStatus;
  matchedAt: string;
  /** Laporan milik pengguna */
  own: { itemId: number; itemType: ItemType; itemName: string };
  /** Laporan lawan: HANYA kolom publik (tanpa private_identifier / identitas pelapor). */
  other: {
    itemId: number; itemType: ItemType; itemName: string; categoryName: string; locationName: string;
    color: string | null; description: string | null; incidentDate: string; itemStatus: ItemStatus; hasPhoto: boolean;
  };
}

/** FR-16: rekomendasi yang berkaitan dengan laporan milik pengguna. */
export async function listMatchesForUser(userId: number, opts: { itemId?: number; includeDismissed?: boolean } = {}): Promise<MatchView[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT m.match_id, m.similarity_score, m.match_status, m.matched_at,
            l.item_id AS l_id, l.user_id AS l_user, l.item_name AS l_name, l.item_status AS l_status,
            l.color AS l_color, l.description AS l_desc, l.incident_date AS l_date, l.photo_url IS NOT NULL AS l_photo,
            lc.category_name AS l_cat, ll.location_name AS l_loc,
            f.item_id AS f_id, f.user_id AS f_user, f.item_name AS f_name, f.item_status AS f_status,
            f.color AS f_color, f.description AS f_desc, f.incident_date AS f_date, f.photo_url IS NOT NULL AS f_photo,
            fc.category_name AS f_cat, fl.location_name AS f_loc
       FROM item_matches m
       JOIN items l ON l.item_id = m.lost_item_id
       JOIN items f ON f.item_id = m.found_item_id
       JOIN categories lc ON lc.category_id = l.category_id
       JOIN locations ll ON ll.location_id = l.location_id
       JOIN categories fc ON fc.category_id = f.category_id
       JOIN locations fl ON fl.location_id = f.location_id
      WHERE (l.user_id = ? OR f.user_id = ?)
        AND m.match_status IN (${opts.includeDismissed ? "'SUGGESTED','CONFIRMED','DISMISSED'" : "'SUGGESTED','CONFIRMED'"})
        AND l.item_status IN ('OPEN','CLAIM_PENDING') AND f.item_status IN ('OPEN','CLAIM_PENDING')
        ${opts.itemId ? "AND (l.item_id = ? OR f.item_id = ?)" : ""}
      ORDER BY m.similarity_score DESC, m.matched_at DESC
      LIMIT 100`,
    opts.itemId ? [userId, userId, opts.itemId, opts.itemId] : [userId, userId],
  );

  return rows.map((r) => {
    const ownIsLost = r.l_user === userId;
    const p = ownIsLost ? "f" : "l"; // sisi lawan
    const q = ownIsLost ? "l" : "f";
    return {
      matchId: r.match_id as number,
      score: Number(r.similarity_score),
      status: r.match_status as MatchStatus,
      matchedAt: r.matched_at as string,
      own: { itemId: r[`${q}_id`] as number, itemType: ownIsLost ? "LOST" : "FOUND", itemName: r[`${q}_name`] as string },
      other: {
        itemId: r[`${p}_id`] as number,
        itemType: ownIsLost ? "FOUND" : "LOST",
        itemName: r[`${p}_name`] as string,
        categoryName: r[`${p}_cat`] as string,
        locationName: r[`${p}_loc`] as string,
        color: r[`${p}_color`] as string | null,
        description: r[`${p}_desc`] as string | null,
        incidentDate: r[`${p}_date`] as string,
        itemStatus: r[`${p}_status`] as ItemStatus,
        hasPhoto: Boolean(r[`${p}_photo`]),
      },
    };
  });
}

/** Pengguna mengabaikan rekomendasi untuk laporannya (match_status = DISMISSED). Cek kepemilikan salah satu sisi. */
export async function dismissMatch(userId: number, matchId: number): Promise<boolean> {
  const res = await exec(
    `UPDATE item_matches m
       JOIN items l ON l.item_id = m.lost_item_id
       JOIN items f ON f.item_id = m.found_item_id
        SET m.match_status = 'DISMISSED'
      WHERE m.match_id = ? AND m.match_status = 'SUGGESTED' AND (l.user_id = ? OR f.user_id = ?)`,
    [matchId, userId, userId],
  );
  return res.affectedRows > 0;
}
