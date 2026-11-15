/**
 * Inisialisasi skema: menjalankan db/schema.sql (idempotent).
 *   npm run db:init
 * Untuk mengulang dari nol (HAPUS SEMUA DATA): CONFIRM_RESET=yes npm run db:reset
 */
import "./_env";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { scriptDbConfig } from "./_env";

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset && process.env.CONFIRM_RESET !== "yes") {
    console.error("Menolak reset: set CONFIRM_RESET=yes untuk menghapus seluruh tabel.");
    process.exit(1);
  }
  const conn = await mysql.createConnection({ ...scriptDbConfig(), multipleStatements: true });
  try {
    if (reset) {
      const tables = [
        "audit_logs", "sessions", "item_status_histories", "notifications",
        "claims", "item_matches", "items", "locations", "categories", "users",
      ];
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const t of tables) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      console.log("Semua tabel dihapus.");
    }
    const sql = fs.readFileSync(path.resolve(process.cwd(), "db/schema.sql"), "utf8");
    await conn.query(sql);
    const [rows] = await conn.query("SHOW TABLES");
    console.log(`Skema siap. ${(rows as unknown[]).length} tabel tersedia.`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Gagal inisialisasi database:", e.message);
  process.exit(1);
});
