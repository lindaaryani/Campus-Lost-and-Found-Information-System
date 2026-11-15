import { exec, query, queryOne, type Queryable, pool } from "@/lib/db";

export interface NotificationRow {
  notification_id: number;
  item_id: number | null;
  claim_id: number | null;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

/** FR-21: buat notifikasi. Dapat dipanggil di dalam transaksi (kirim `conn`). */
export async function notify(
  conn: Queryable,
  p: { userId: number; title: string; message: string; itemId?: number | null; claimId?: number | null },
) {
  await exec(
    "INSERT INTO notifications (user_id, item_id, claim_id, title, message) VALUES (?, ?, ?, ?, ?)",
    [p.userId, p.itemId ?? null, p.claimId ?? null, p.title, p.message],
    conn,
  );
}

export async function listNotifications(userId: number, opts: { onlyUnread?: boolean; page?: number; pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? 15;
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.onlyUnread ? "user_id = ? AND is_read = 0" : "user_id = ?";
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM notifications WHERE ${where}`, [userId]);
  const rows = await query<NotificationRow>(
    `SELECT notification_id, item_id, claim_id, title, message, is_read, created_at
       FROM notifications WHERE ${where} ORDER BY created_at DESC, notification_id DESC LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function recentNotifications(userId: number, limit = 5) {
  return query<NotificationRow>(
    `SELECT notification_id, item_id, claim_id, title, message, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, notification_id DESC LIMIT ?`,
    [userId, limit],
  );
}

export async function unreadCount(userId: number): Promise<number> {
  const r = await queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0", [userId]);
  return r?.c ?? 0;
}

/** FR-30: tandai dibaca. Klausa `user_id` memastikan hanya pemilik yang bisa mengubah (ownership check). */
export async function markRead(userId: number, notificationId: number): Promise<boolean> {
  const res = await exec("UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?", [notificationId, userId], pool);
  return res.affectedRows > 0;
}

export async function markAllRead(userId: number): Promise<number> {
  const res = await exec("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId], pool);
  return res.affectedRows;
}
