/**
 * Seed data master + akun ADMIN pertama.   npm run db:seed
 * Data kategori & lokasi di bawah adalah CONTOH UMUM; sesuaikan lewat menu Admin.
 */
import "./_env";
import mysql from "mysql2/promise";
import { hash } from "@node-rs/argon2";
import { scriptDbConfig } from "./_env";

const CATEGORIES: [string, string][] = [
  ["Dompet & Kartu", "Dompet, kartu mahasiswa/pegawai, kartu ATM, e-money"],
  ["Tas & Ransel", "Tas, ransel, tas laptop, tas selempang"],
  ["Ponsel & Gadget", "Ponsel, tablet, smartwatch, earphone, power bank"],
  ["Laptop & Aksesori Komputer", "Laptop, charger, mouse, flashdisk, hard disk eksternal"],
  ["Kunci & Gantungan", "Kunci kendaraan, kunci ruangan, gantungan kunci"],
  ["Dokumen & Alat Tulis", "Map, buku, KTP/SIM, alat tulis, kalkulator"],
  ["Pakaian & Aksesori", "Jaket, topi, kacamata, jam tangan, perhiasan"],
  ["Botol & Peralatan Makan", "Botol minum, tumbler, kotak makan"],
  ["Lainnya", "Barang yang tidak termasuk kategori lain"],
];

const LOCATIONS: [string, string][] = [
  ["Gedung Utama", "Area gedung perkuliahan utama"],
  ["Perpustakaan", "Ruang baca dan area peminjaman"],
  ["Kantin", "Area makan dan kantin kampus"],
  ["Area Parkir", "Parkir kendaraan roda dua dan roda empat"],
  ["Laboratorium Komputer", "Laboratorium dan ruang praktikum"],
  ["Ruang Kelas", "Ruang kuliah reguler"],
  ["Aula", "Aula dan ruang acara"],
  ["Lobi & Resepsionis", "Area penerimaan dan lobi"],
  ["Taman & Area Terbuka", "Taman, selasar, dan area luar ruangan"],
  ["Toilet & Mushola", "Fasilitas umum kampus"],
];

async function main() {
  const conn = await mysql.createConnection(scriptDbConfig());
  try {
    for (const [name, desc] of CATEGORIES)
      await conn.execute("INSERT IGNORE INTO categories (category_name, description) VALUES (?, ?)", [name, desc]);
    for (const [name, desc] of LOCATIONS)
      await conn.execute("INSERT IGNORE INTO locations (location_name, description) VALUES (?, ?)", [name, desc]);

    const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 10) {
      throw new Error("SEED_ADMIN_PASSWORD wajib diisi (minimal 10 karakter).");
    }
    const [existing] = await conn.execute("SELECT user_id FROM users WHERE username = ?", [username]);
    if ((existing as unknown[]).length === 0) {
      const passwordHash = await hash(password); // Argon2id (default @node-rs/argon2)
      await conn.execute(
        `INSERT INTO users (username, full_name, email, password_hash, role, account_status)
         VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE')`,
        [username, process.env.SEED_ADMIN_NAME ?? "Administrator", process.env.SEED_ADMIN_EMAIL ?? "admin@campusfind.local", passwordHash],
      );
      console.log(`Akun ADMIN dibuat: username "${username}".`);
    } else {
      console.log(`Akun ADMIN "${username}" sudah ada, dilewati.`);
    }
    console.log("Seed data master selesai.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Seed gagal:", e.message);
  process.exit(1);
});
