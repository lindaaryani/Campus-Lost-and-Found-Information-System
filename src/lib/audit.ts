import { exec, type Queryable, pool } from "./db";

/** FR-32 / NFR-10 / BR-12: catat aktivitas penting (siapa, apa, kapan). */
export async function writeAudit(
  actorId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  details: Record<string, unknown> | null = null,
  conn: Queryable = pool,
) {
  await exec(
    "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
    [actorId, action, entityType, entityId, details ? JSON.stringify(details) : null],
    conn,
  );
}
