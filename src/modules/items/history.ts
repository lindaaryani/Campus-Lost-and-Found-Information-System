import { exec, type Queryable } from "@/lib/db";

/** FR-25 / BR-12: setiap perubahan status laporan dicatat bersama waktu & pelaku. */
export async function recordStatusChange(
  conn: Queryable,
  itemId: number,
  changedBy: number,
  oldStatus: string | null,
  newStatus: string,
  note: string | null,
) {
  await exec(
    "INSERT INTO item_status_histories (item_id, changed_by, old_status, new_status, change_note) VALUES (?, ?, ?, ?, ?)",
    [itemId, changedBy, oldStatus, newStatus, note],
    conn,
  );
}
