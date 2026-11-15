import { query, queryOne } from "@/lib/db";
import type { ClaimStatus, ItemStatus, SessionUser } from "@/lib/types";
import { AdminError } from "./users";

export interface Stats {
  totals: { items: number; lost: number; found: number; claims: number; pendingClaims: number; users: number; returned: number };
  itemsByStatus: { status: ItemStatus; type: "LOST" | "FOUND"; count: number }[];
  claimsByStatus: { status: ClaimStatus; count: number }[];
  byCategory: { name: string; lost: number; found: number }[];
  byLocation: { name: string; lost: number; found: number }[];
  monthly: { month: string; lost: number; found: number }[];
  returnRate: number | null;
}

/** FR-26: statistik laporan, klaim, dan status barang. */
export async function getStats(admin: SessionUser): Promise<Stats> {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  const t = (await queryOne<Record<string, number>>(
    `SELECT (SELECT COUNT(*) FROM items) AS items,
            (SELECT COUNT(*) FROM items WHERE item_type='LOST') AS lost,
            (SELECT COUNT(*) FROM items WHERE item_type='FOUND') AS found,
            (SELECT COUNT(*) FROM claims) AS claims,
            (SELECT COUNT(*) FROM claims WHERE claim_status IN ('PENDING','NEED_INFO')) AS pending,
            (SELECT COUNT(*) FROM users WHERE role='USER') AS users,
            (SELECT COUNT(*) FROM items WHERE item_status='RETURNED') AS returned`,
  ))!;
  const itemsByStatus = await query<{ status: ItemStatus; type: "LOST" | "FOUND"; count: number }>(
    "SELECT item_status AS status, item_type AS type, COUNT(*) AS count FROM items GROUP BY item_status, item_type");
  const claimsByStatus = await query<{ status: ClaimStatus; count: number }>(
    "SELECT claim_status AS status, COUNT(*) AS count FROM claims GROUP BY claim_status");
  const byCategory = await query<{ name: string; lost: number; found: number }>(
    `SELECT c.category_name AS name, SUM(i.item_type='LOST') AS lost, SUM(i.item_type='FOUND') AS found
       FROM items i JOIN categories c ON c.category_id = i.category_id
      GROUP BY c.category_id, c.category_name ORDER BY COUNT(*) DESC LIMIT 8`);
  const byLocation = await query<{ name: string; lost: number; found: number }>(
    `SELECT l.location_name AS name, SUM(i.item_type='LOST') AS lost, SUM(i.item_type='FOUND') AS found
       FROM items i JOIN locations l ON l.location_id = i.location_id
      GROUP BY l.location_id, l.location_name ORDER BY COUNT(*) DESC LIMIT 8`);
  const monthly = await query<{ month: string; lost: number; found: number }>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(item_type='LOST') AS lost, SUM(item_type='FOUND') AS found
       FROM items WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month ASC`);
  const foundReturned = (await queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM items WHERE item_type='FOUND' AND item_status='RETURNED'"))!.c;
  return {
    totals: { items: Number(t.items), lost: Number(t.lost), found: Number(t.found), claims: Number(t.claims),
      pendingClaims: Number(t.pending), users: Number(t.users), returned: Number(t.returned) },
    itemsByStatus: itemsByStatus.map((r) => ({ ...r, count: Number(r.count) })),
    claimsByStatus: claimsByStatus.map((r) => ({ ...r, count: Number(r.count) })),
    byCategory: byCategory.map((r) => ({ name: r.name, lost: Number(r.lost), found: Number(r.found) })),
    byLocation: byLocation.map((r) => ({ name: r.name, lost: Number(r.lost), found: Number(r.found) })),
    monthly: monthly.map((r) => ({ month: r.month, lost: Number(r.lost), found: Number(r.found) })),
    returnRate: Number(t.found) > 0 ? Math.round((Number(foundReturned) / Number(t.found)) * 100) : null,
  };
}
