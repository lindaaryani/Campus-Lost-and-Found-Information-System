/**
 * Benchmark NFR-05 (daftar/pencarian <= 3 detik). Mengisi 20.000 laporan sintetis ke DB *_test lalu mengukur.
 *   DB_NAME=campusfind_test npm run test:perf
 */
import "../scripts/_env";
import assert from "node:assert/strict";
import { pool, query, queryOne, exec } from "../src/lib/db";
import { listItems } from "../src/modules/items/service";
import { runMatchingForItem } from "../src/modules/matching/service";
import type { SessionUser } from "../src/lib/types";

if (!process.env.DB_NAME?.endsWith("_test")) throw new Error("Hanya untuk database *_test");

async function timeit<T>(label: string, fn: () => Promise<T>, runs = 5) {
  const ts: number[] = [];
  for (let i = 0; i < runs; i++) { const t = performance.now(); await fn(); ts.push(performance.now() - t); }
  ts.sort((a, b) => a - b);
  const med = ts[Math.floor(runs / 2)];
  console.log(`  ${label.padEnd(58)} median ${med.toFixed(0).padStart(5)} ms  (maks ${ts[runs - 1].toFixed(0)} ms)`);
  assert.ok(ts[runs - 1] < 3000, `${label} melewati 3 detik`);
}

async function main() {
  const N = 20000;
  const user = (await queryOne<{ user_id: number }>("SELECT user_id FROM users WHERE role='USER' LIMIT 1"))!;
  const admin = (await queryOne<{ user_id: number }>("SELECT user_id FROM users WHERE role='ADMIN' LIMIT 1"))!;
  const viewer = { userId: user.user_id, role: "USER" } as SessionUser;
  const adminU = { userId: admin.user_id, role: "ADMIN" } as SessionUser;

  await exec("SET FOREIGN_KEY_CHECKS=0");
  for (const t of ["item_matches", "claims", "notifications", "item_status_histories", "items"]) await exec(`TRUNCATE ${t}`);
  await exec("SET FOREIGN_KEY_CHECKS=1");
  await exec("SET SESSION cte_max_recursion_depth = 100000");
  const ids = async (sql: string) => (await query<{ id: number }>(sql)).map((r) => r.id);
  const uIds = await ids("SELECT user_id AS id FROM users WHERE role='USER' ORDER BY user_id LIMIT 4");
  const cIds = await ids("SELECT category_id AS id FROM categories ORDER BY category_id");
  const lIds = await ids("SELECT location_id AS id FROM locations ORDER BY location_id");
  const t0 = performance.now();
  await exec(
    `INSERT INTO items (user_id, category_id, location_id, item_type, item_name, color, description, incident_date, private_identifier, item_status, created_at)
     WITH RECURSIVE seq AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < ${N})
     SELECT ELT(1 + n % ${uIds.length}, ${uIds.join(',')}),
            ELT(1 + n % ${cIds.length}, ${cIds.join(',')}),
            ELT(1 + n % ${lIds.length}, ${lIds.join(',')}),
            IF(n % 2 = 0, 'LOST', 'FOUND'),
            CONCAT(ELT(1 + n % 8, 'Dompet', 'Tas ransel', 'Kunci motor', 'Laptop', 'Botol minum', 'Payung', 'Jaket', 'Earphone'), ' ', ELT(1 + n % 6, 'hitam', 'biru', 'merah', 'coklat', 'putih', 'abu-abu'), ' #', n),
            ELT(1 + n % 6, 'hitam', 'biru', 'merah', 'coklat', 'putih', 'abu-abu'),
            CONCAT('Deskripsi barang nomor ', n, ' ditemukan di sekitar kampus dengan ciri tertentu'),
            DATE_SUB(CURDATE(), INTERVAL (n % 200) DAY), 'rahasia', ELT(1 + n % 10, 'OPEN','OPEN','OPEN','OPEN','OPEN','OPEN','CLAIM_PENDING','RETURNED','CLOSED','OPEN'),
            DATE_SUB(UTC_TIMESTAMP(), INTERVAL n MINUTE)
       FROM seq`,
  );
  console.log(`Data sintetis: ${N} laporan dimasukkan dalam ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  const [{ c }] = await query<{ c: number }>("SELECT COUNT(*) c FROM items");
  console.log(`Total baris items: ${c}\n\nWaktu respons layanan (mencakup COUNT + halaman 12 baris):`);

  await timeit("Daftar publik, halaman 1, tanpa filter", () => listItems("public", viewer, {}));
  await timeit("Daftar publik, halaman 500", () => listItems("public", viewer, { page: 500 }));
  await timeit("Daftar Barang Ditemukan (type=FOUND)", () => listItems("public", viewer, { type: "FOUND" }));
  await timeit("Pencarian kata kunci 'dompet'", () => listItems("public", viewer, { q: "dompet" }));
  await timeit("Pencarian dua kata 'tas hitam'", () => listItems("public", viewer, { q: "tas hitam" }));
  await timeit("Pencarian kata tanpa hasil 'xyzabc'", () => listItems("public", viewer, { q: "xyzabc" }));
  await timeit("Filter kategori + lokasi + rentang tanggal", () => listItems("public", viewer, { categoryId: 1, locationId: 1, dateFrom: "2026-06-01", dateTo: "2026-12-31" }));
  await timeit("Laporan saya (mine)", () => listItems("mine", viewer, {}));
  await timeit("Daftar admin semua laporan", () => listItems("admin", adminU, {}));

  // Pencocokan: laporan FOUND baru terhadap hingga 1.000 kandidat LOST OPEN
  const [cat] = await query<{ category_id: number }>("SELECT category_id FROM categories LIMIT 1");
  const [loc] = await query<{ location_id: number }>("SELECT location_id FROM locations LIMIT 1");
  const res = await exec(
    `INSERT INTO items (user_id, category_id, location_id, item_type, item_name, color, description, incident_date, item_status)
     VALUES (?, ?, ?, 'FOUND', 'Dompet hitam', 'hitam', 'Dompet hitam ditemukan di kantin', CURDATE(), 'OPEN')`,
    [admin.user_id, cat.category_id, loc.location_id]);
  const t1 = performance.now();
  const m = await runMatchingForItem(res.insertId);
  console.log(`  ${"Pencocokan 1 laporan baru vs <=1.000 kandidat".padEnd(58)} ${(performance.now() - t1).toFixed(0).padStart(5)} ms  (pasangan baru: ${m.created})`);
  console.log("\nSemua pengukuran < 3 detik pada 20.000 laporan.");
  await pool.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
