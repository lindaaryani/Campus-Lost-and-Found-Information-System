import { query } from "@/lib/db";
import type { ClaimStatus, ItemStatus, ItemType } from "@/lib/types";

/** Ringkasan dashboard USER. */
export async function getUserDashboard(userId: number) {
  const byType = await query<{ item_type: ItemType; item_status: ItemStatus; c: number }>(
    "SELECT item_type, item_status, COUNT(*) AS c FROM items WHERE user_id = ? GROUP BY item_type, item_status", [userId]);
  const claims = await query<{ claim_status: ClaimStatus; c: number }>(
    "SELECT claim_status, COUNT(*) AS c FROM claims WHERE claimant_id = ? GROUP BY claim_status", [userId]);
  const count = (pred: (r: { item_type: ItemType; item_status: ItemStatus }) => boolean) =>
    byType.filter(pred).reduce((s, r) => s + Number(r.c), 0);
  return {
    lostOpen: count((r) => r.item_type === "LOST" && r.item_status === "OPEN"),
    foundOpen: count((r) => r.item_type === "FOUND" && (r.item_status === "OPEN" || r.item_status === "CLAIM_PENDING")),
    totalReports: count(() => true),
    activeClaims: claims.filter((r) => r.claim_status === "PENDING" || r.claim_status === "NEED_INFO").reduce((s, r) => s + Number(r.c), 0),
    needInfoClaims: claims.filter((r) => r.claim_status === "NEED_INFO").reduce((s, r) => s + Number(r.c), 0),
  };
}
