import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

/**
 * Pool MySQL tunggal (di-cache pada globalThis agar tidak bocor saat hot reload).
 * Semua nilai dari pengguna WAJIB lewat placeholder `?` (di-escape oleh mysql2),
 * tidak pernah digabung ke string SQL => perlindungan SQL injection.
 * Waktu disimpan UTC; DATE/TIMESTAMP dikembalikan sebagai string (dateStrings).
 */
const g = globalThis as unknown as { __cfPool?: Pool };

function createPool(): Pool {
  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "campusfind",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "campusfind",
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as any).pool.on("connection", (c: { query: (q: string) => void }) => {
    c.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export const pool: Pool = g.__cfPool ?? (g.__cfPool = createPool());

export type Queryable = Pool | PoolConnection;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  conn: Queryable = pool,
): Promise<T[]> {
  const [rows] = await conn.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  conn: Queryable = pool,
): Promise<T | null> {
  const rows = await query<T>(sql, params, conn);
  return rows[0] ?? null;
}

export async function exec(sql: string, params: unknown[] = [], conn: Queryable = pool): Promise<ResultSetHeader> {
  const [res] = await conn.query(sql, params);
  return res as ResultSetHeader;
}

/** Jalankan fn dalam satu transaksi (NFR-17: konsistensi data). */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
