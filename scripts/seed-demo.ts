/**
 * Data DEMO (opsional, hanya untuk pengembangan/presentasi):  npm run db:seed-demo
 * Membuat 3 pengguna contoh + beberapa laporan yang sengaja saling mirip.
 * JANGAN dijalankan di produksi: kata sandi demo diketahui publik.
 */
import "./_env";
import mysql from "mysql2/promise";
import { hash } from "@node-rs/argon2";
import { scriptDbConfig } from "./_env";

const DEMO_PASSWORD = "Demo12345";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed demo ditolak di NODE_ENV=production.");
  const conn = await mysql.createConnection(scriptDbConfig());
  try {
    const pw = await hash(DEMO_PASSWORD);
    const users: [string, string, string, string, string, string][] = [
      ["STUDENT", "NIM", "240030001", "Made Dewi Lestari", "dewi@demo.campusfind.id", "081234500001"],
      ["LECTURER", "NIDN", "0412068801", "Dr. Komang Arya Putra", "arya@demo.campusfind.id", "081234500002"],
      ["STAFF", "NIP", "198503122010011", "Wayan Sudiartha", "sudiartha@demo.campusfind.id", "081234500003"],
    ];
    const ids: number[] = [];
    for (const [ut, it, no, name, email, phone] of users) {
      await conn.execute(
        `INSERT IGNORE INTO users (user_type, identity_type, identity_number, full_name, email, phone_number, password_hash, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'USER')`, [ut, it, no, name, email, phone, pw]);
      const [r] = await conn.execute("SELECT user_id FROM users WHERE email = ?", [email]);
      ids.push((r as { user_id: number }[])[0].user_id);
    }
    const [cats] = await conn.query("SELECT category_id, category_name FROM categories");
    const [locs] = await conn.query("SELECT location_id, location_name FROM locations");
    const cat = (n: string) => (cats as { category_id: number; category_name: string }[]).find((c) => c.category_name.startsWith(n))!.category_id;
    const loc = (n: string) => (locs as { location_id: number; location_name: string }[]).find((l) => l.location_name.startsWith(n))!.location_id;
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

    const [existing] = await conn.query("SELECT COUNT(*) AS c FROM items");
    if ((existing as { c: number }[])[0].c > 0) { console.log("Tabel items sudah berisi data; laporan demo dilewati."); return; }

    const items: [number, string, string, string, string, string, string, number, string | null][] = [
      [ids[0], "LOST", "Dompet kulit coklat", "Dompet Kulit", "Coklat", "Dompet kulit coklat berisi kartu mahasiswa dan KTP, ada sedikit goresan di sudut.", "Kantin", 3, null],
      [ids[2], "FOUND", "Dompet warna cokelat", "Dompet", "Cokelat", "Dompet kulit warna cokelat ditemukan di meja kantin, ada kartu di dalamnya.", "Kantin", 2, "Ada stiker kecil bergambar bunga di dalam lipatan dan satu kartu perpustakaan."],
      [ids[1], "LOST", "Laptop ASUS abu-abu", "Laptop", "Abu-abu", "Laptop ASUS 14 inci abu-abu dengan stiker logo kampus di bagian atas.", "Laboratorium", 5, null],
      [ids[0], "FOUND", "Kunci motor Honda", "Kunci", "Hitam", "Kunci motor Honda dengan gantungan hitam ditemukan di area parkir.", "Area Parkir", 1, "Gantungan berbentuk boneka kecil berwarna merah."],
      [ids[2], "FOUND", "Botol minum biru", "Botol", "Biru", "Botol minum biru tua merek Tupperware tertinggal di ruang kelas.", "Ruang Kelas", 4, "Ada nama inisial 'KP' di bagian bawah botol."],
    ];
    for (const [uid, type, name, catName, color, desc, locName, ago, priv] of items) {
      const [res] = await conn.execute(
        `INSERT INTO items (user_id, category_id, location_id, item_type, item_name, color, description, incident_date, private_identifier, item_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
        [uid, cat(catName === "Laptop" ? "Laptop" : catName === "Kunci" ? "Kunci" : catName === "Botol" ? "Botol" : "Dompet"), loc(locName), type, name, color, desc, day(ago), priv]);
      await conn.execute("INSERT INTO item_status_histories (item_id, changed_by, old_status, new_status, change_note) VALUES (?, ?, NULL, 'OPEN', 'Laporan dibuat (data demo)')",
        [(res as { insertId: number }).insertId, uid]);
    }
    console.log("Data demo dibuat. Masuk sebagai: Mahasiswa NIM 240030001 / Dosen NIDN 0412068801 / Staf NIP 198503122010011, kata sandi:", DEMO_PASSWORD);
    console.log("Catatan: pencocokan otomatis dijalankan saat laporan dibuat lewat aplikasi, bukan lewat seed ini.");
  } finally { await conn.end(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
