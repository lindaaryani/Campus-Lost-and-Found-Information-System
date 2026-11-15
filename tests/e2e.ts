/**
 * E2E (Playwright/Chromium) terhadap server produksi + MySQL uji.
 * Alur lengkap lintas peran, uji otorisasi, kebocoran data, dan responsivitas dasar.
 *   BASE_URL=http://localhost:3100 npm run test:e2e
 */
import "../scripts/_env";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { chromium, type BrowserContext, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "/home/claude/shots";
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD!;
const SECRET = "GORESAN-RAHASIA-QWE789";
/** PNG valid (bukan sekadar signature) agar tampilan foto pada screenshot realistis. */
function makePng(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, (_, x) => [Math.min(255, r + (x % 40)), g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PNG = makePng(480, 300, [120, 80, 50]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

let passed = 0, failed = 0;
const consoleErrors: string[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log("  ok -", name); }
  catch (e) { failed++; console.error("  GAGAL -", name, "\n    ", String((e as Error).message).split("\n").slice(0, 4).join("\n     ")); }
}

function watch(page: Page, who: string) {
  page.on("pageerror", (e) => consoleErrors.push(`[${who}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource.*(401|404)/.test(m.text())) consoleErrors.push(`[${who}] console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 500) consoleErrors.push(`[${who}] HTTP ${r.status()} ${r.url()}`); });
}

async function register(ctx: BrowserContext, who: string, o: { type: "STUDENT" | "LECTURER" | "STAFF"; number: string; name: string; email: string }) {
  const p = await ctx.newPage(); watch(p, who);
  await p.goto(`${BASE}/register`);
  await p.getByLabel("Saya adalah").selectOption(o.type);
  await p.getByLabel(/^Nomor (NIM|NIDN|NIP|ID)/).fill(o.number);
  await p.getByLabel("Nama lengkap").fill(o.name);
  await p.getByLabel("Email").fill(o.email);
  await p.getByLabel(/^Kata sandi/).fill("Password123");
  await p.getByLabel("Ulangi kata sandi").fill("Password123");
  await p.getByRole("button", { name: "Buat akun" }).click();
  await p.waitForURL("**/dashboard");
  return p;
}

async function fillItem(p: Page, o: { name: string; cat: string; loc: string; color: string; desc: string; priv?: string }) {
  await p.getByLabel("Nama barang").fill(o.name);
  await p.getByLabel("Kategori").selectOption({ label: o.cat });
  await p.getByLabel(/^(Lokasi)/).selectOption({ label: o.loc });
  await p.getByLabel("Warna").fill(o.color);
  await p.getByLabel("Deskripsi barang").fill(o.desc);
  if (o.priv) await p.getByLabel("Ciri khusus").fill(o.priv);
  await p.locator('input[type="file"][name="photo"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
}

async function shot(p: Page, name: string) { await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); }

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", args: ["--no-sandbox"] });
  const mk = (w = 1366, h = 850) => browser.newContext({ viewport: { width: w, height: h }, locale: "id-ID", timezoneId: "Asia/Makassar" });
  const finderCtx = await mk(), loserCtx = await mk(), otherCtx = await mk(), adminCtx = await mk(), anonCtx = await mk();
  let finder!: Page, loser!: Page, other!: Page, admin!: Page;
  let foundUrl = "", claimUrl = "";

  console.log("\nAkses & autentikasi");
  await step("pengguna anonim dialihkan ke /login dari halaman terlindungi", async () => {
    const p = await anonCtx.newPage(); watch(p, "anon");
    for (const path of ["/dashboard", "/admin", "/klaim", "/barang/1", "/admin/klaim"]) {
      await p.goto(BASE + path); await p.waitForURL("**/login");
    }
    await shot(p, "01-login-desktop");
    assert.ok(await p.getByRole("button", { name: "Masuk" }).isVisible());
  });
  await step("API berkas menolak anonim (401) tanpa membocorkan data", async () => {
    assert.equal((await anonCtx.request.get(`${BASE}/api/files/photo/1`)).status(), 401);
    assert.equal((await anonCtx.request.get(`${BASE}/api/files/evidence/1`)).status(), 401);
  });
  await step("registrasi Staf (penemu) & Mahasiswa (kehilangan) + validasi form", async () => {
    const p = await anonCtx.newPage(); watch(p, "anon2");
    await p.goto(`${BASE}/register`);
    await p.getByLabel(/^Nomor (NIM|NIDN|NIP|ID)/).fill("12");           // terlalu pendek -> validasi native/klien
    await p.getByRole("button", { name: "Buat akun" }).click();
    assert.ok(p.url().includes("/register"), "form tidak terkirim saat data tidak valid");
    finder = await register(finderCtx, "finder", { type: "STAFF", number: "198501012010", name: "Wayan Penemu", email: "penemu@e2e.id" });
    loser = await register(loserCtx, "loser", { type: "STUDENT", number: "240030111", name: "Dewi Kehilangan", email: "dewi@e2e.id" });
    other = await register(otherCtx, "other", { type: "LECTURER", number: "0412068899", name: "Komang Lain", email: "lain@e2e.id" });
    assert.ok(await loser.getByRole("heading", { name: /Halo, Dewi/ }).isVisible());
    await shot(loser, "02-dashboard-kosong");
  });
  await step("login salah ditolak dengan pesan generik; login benar masuk", async () => {
    const p = await anonCtx.newPage(); watch(p, "anon3");
    await p.goto(`${BASE}/login`);
    await p.getByText("Mahasiswa", { exact: true }).click();
    await p.getByLabel(/^Nomor NIM/).fill("240030111");
    await p.getByLabel("Kata sandi").fill("SalahTotal1");
    await p.getByRole("button", { name: "Masuk" }).click();
    await p.getByText(/Identitas atau kata sandi salah/).waitFor();
    await p.getByLabel("Kata sandi").fill("Password123");
    await p.getByRole("button", { name: "Masuk" }).click();
    await p.waitForURL("**/dashboard");
  });

  console.log("\nLaporan, pencocokan, privasi");
  await step("Mahasiswa membuat laporan kehilangan (dengan foto) via UI", async () => {
    await loser.goto(`${BASE}/laporan/hilang/baru`);
    await shot(loser, "03-form-lapor-hilang");
    await fillItem(loser, { name: "Dompet kulit coklat", cat: "Dompet & Kartu", loc: "Kantin", color: "Coklat", desc: "Dompet kulit coklat berisi kartu mahasiswa dan KTP" });
    await loser.getByRole("button", { name: "Kirim laporan kehilangan" }).click();
    await loser.waitForURL(/\/barang\/\d+\?baru=1/);
    assert.ok(await loser.getByText("Laporan berhasil dikirim").isVisible());
  });
  await step("Staf membuat laporan temuan mirip => rekomendasi muncul untuk penemu", async () => {
    await finder.goto(`${BASE}/laporan/ditemukan/baru`);
    await finder.getByRole("button", { name: "Kirim laporan temuan" }).click();      // kosong => validasi
    assert.ok(finder.url().includes("/laporan/ditemukan/baru"));
    await fillItem(finder, { name: "Dompet cokelat", cat: "Dompet & Kartu", loc: "Kantin", color: "cokelat", desc: "Dompet kulit cokelat ditemukan di meja kantin, ada kartu di dalam", priv: `Ada ${SECRET} di bagian dalam` });
    await finder.getByRole("button", { name: "Kirim laporan temuan" }).click();
    await finder.waitForURL(/\/barang\/\d+\?baru=1/);
    foundUrl = finder.url().split("?")[0];
    await finder.getByRole("heading", { name: "Rekomendasi kecocokan" }).waitFor();
    assert.ok(await finder.getByText(/Dompet kulit coklat/).first().isVisible());
    assert.ok((await finder.content()).includes(SECRET), "pemilik melihat ciri khusus miliknya");
    await shot(finder, "04-detail-pemilik-rekomendasi");
  });
  await step("pengguna lain TIDAK melihat ciri khusus (HTML + RSC payload) tetapi melihat data publik", async () => {
    await other.goto(foundUrl);
    const html = await other.content();
    assert.ok(!html.includes(SECRET), "ciri khusus bocor ke pengguna lain!");
    assert.ok(await other.getByRole("heading", { name: "Dompet cokelat" }).isVisible());
    assert.ok(await other.getByRole("link", { name: /Ajukan klaim/ }).isVisible());
    const rsc = await otherCtx.request.get(foundUrl, { headers: { RSC: "1" } });
    assert.ok(!(await rsc.text()).includes(SECRET), "ciri khusus bocor di payload RSC!");
    await other.goto(`${BASE}/cari?q=dompet`);
    assert.ok(!(await other.content()).includes(SECRET));
    await shot(other, "05-cari");
  });
  await step("Mahasiswa melihat rekomendasi & notifikasi kecocokan", async () => {
    await loser.goto(`${BASE}/rekomendasi`);
    await loser.getByText("Dompet cokelat").first().waitFor();
    assert.ok(!(await loser.content()).includes(SECRET));
    await shot(loser, "06-rekomendasi");
    await loser.goto(`${BASE}/notifikasi`);
    await loser.getByText("Kemungkinan barang Anda ditemukan").first().waitFor();
    await loser.getByRole("button", { name: "Tandai semua dibaca" }).click();
    await loser.waitForLoadState("networkidle");
  });
  await step("pencarian & filter berfungsi (kategori, kata kunci tanpa hasil)", async () => {
    await other.goto(`${BASE}/barang-ditemukan`);
    assert.ok(await other.getByText("Dompet cokelat").first().isVisible());
    await other.goto(`${BASE}/cari?q=xyztidakada`);
    await other.getByText("Tidak ada laporan yang cocok").waitFor();
  });

  await step("ubah profil (FR-07): data tersimpan; email duplikat ditolak", async () => {
    await loser.goto(`${BASE}/profil`);
    await loser.getByLabel(/^Nomor telepon/).fill("081234567890");
    await loser.getByRole("button", { name: "Simpan perubahan" }).click();
    await loser.getByText("Profil diperbarui.").waitFor();
    await loser.reload();
    assert.equal(await loser.getByLabel(/^Nomor telepon/).inputValue(), "081234567890");
    await loser.getByLabel("Email").fill("penemu@e2e.id"); // milik pengguna lain
    await loser.getByRole("button", { name: "Simpan perubahan" }).click();
    await loser.getByText(/Email ini sudah dipakai akun lain/).first().waitFor();
    await shot(loser, "16-profil-galat");
  });

  console.log("\nKlaim & verifikasi admin");
  await step("Mahasiswa mengajukan klaim dengan bukti PDF", async () => {
    await loser.goto(foundUrl);
    await loser.getByRole("link", { name: /Ajukan klaim/ }).click();
    await loser.getByLabel("Catatan klaim").fill("Pendek");
    await loser.getByRole("button", { name: "Kirim klaim" }).click();
    assert.ok(loser.url().includes("/klaim"), "catatan < 20 karakter ditolak");
    await loser.getByLabel("Catatan klaim").fill("Dompet itu milik saya; di dalamnya ada goresan inisial pada lipatan kartu.");
    await loser.locator('input[type="file"][name="evidence"]').setInputFiles({ name: "bukti.pdf", mimeType: "application/pdf", buffer: PDF });
    await loser.getByRole("button", { name: "Kirim klaim" }).click();
    await loser.waitForURL(/\/klaim\?diajukan=1/);
    await loser.getByText("Menunggu pemeriksaan").first().waitFor();
    await shot(loser, "07-klaim-saya");
  });
  await step("pengguna lain tidak bisa mengklaim barang yang sedang diklaim; bukti klaim hanya untuk pengaju/admin", async () => {
    await other.goto(`${foundUrl}/klaim`);
    await other.getByText(/tidak dapat diklaim/).waitFor();
    const evId = (await loserCtx.request.get(`${BASE}/klaim`)).ok();
    assert.ok(evId);
    const claimsHtml = await (await loserCtx.request.get(`${BASE}/klaim`)).text();
    const claimId = claimsHtml.match(/\/api\/files\/evidence\/(\d+)/)?.[1];
    assert.ok(claimId, "tautan bukti ditemukan");
    assert.equal((await loserCtx.request.get(`${BASE}/api/files/evidence/${claimId}`)).status(), 200);
    assert.equal((await otherCtx.request.get(`${BASE}/api/files/evidence/${claimId}`)).status(), 404);
    assert.equal((await finderCtx.request.get(`${BASE}/api/files/evidence/${claimId}`)).status(), 404);
    claimUrl = `${BASE}/admin/klaim/${claimId}`;
  });
  await step("USER tidak dapat membuka area ADMIN (dialihkan ke dashboard)", async () => {
    await loser.goto(`${BASE}/admin/klaim`); await loser.waitForURL("**/dashboard");
    await loser.goto(claimUrl); await loser.waitForURL("**/dashboard");
  });
  await step("ADMIN login lewat halaman yang sama (tab Admin)", async () => {
    admin = await adminCtx.newPage(); watch(admin, "admin");
    await admin.goto(`${BASE}/login`);
    await admin.getByText("Admin", { exact: true }).click();
    await admin.getByLabel("Username admin").fill("admin");
    await admin.getByLabel("Kata sandi").fill(ADMIN_PW);
    await admin.getByRole("button", { name: "Masuk" }).click();
    await admin.waitForURL("**/admin");
    await admin.getByRole("heading", { name: "Dashboard Admin" }).waitFor();
    await shot(admin, "08-admin-dashboard");
  });
  await step("ADMIN melihat ciri khusus rahasia & bukti pada detail klaim", async () => {
    await admin.goto(claimUrl);
    assert.ok((await admin.content()).includes(SECRET), "admin melihat ciri khusus");
    assert.ok(await admin.getByRole("link", { name: /Buka bukti kepemilikan/ }).isVisible());
    await shot(admin, "09-admin-detail-klaim");
  });
  await step("ADMIN meminta bukti tambahan (catatan wajib) => pengaju melengkapi", async () => {
    await admin.getByRole("button", { name: "Minta bukti tambahan" }).click();
    const dlg = admin.getByRole("dialog");
    await dlg.getByRole("button", { name: "Kirim permintaan" }).click();           // tanpa catatan
    assert.ok(await dlg.isVisible(), "dialog tetap terbuka bila catatan kosong");
    await dlg.getByLabel(/Apa yang perlu dilengkapi/).fill("Sebutkan ciri khusus yang ada di dalam dompet.");
    await dlg.getByRole("button", { name: "Kirim permintaan" }).click();
    await admin.getByText("Permintaan bukti tambahan dikirim ke pengaju.").waitFor();
    await loser.goto(`${BASE}/klaim`);
    await loser.getByText("Perlu bukti tambahan").first().waitFor();
    await loser.getByRole("button", { name: "Lengkapi informasi" }).click();
    const d2 = loser.getByRole("dialog");
    await d2.getByLabel("Informasi tambahan").fill(`Ada goresan inisial berbentuk ${SECRET.slice(0, 7)} pada lipatan.`);
    await d2.getByRole("button", { name: "Kirim informasi" }).click();
    await loser.getByText(/Informasi tambahan terkirim/).waitFor();
  });
  await step("ADMIN menyetujui klaim lalu mengonfirmasi serah terima => RETURNED", async () => {
    await admin.goto(claimUrl);
    await admin.getByRole("button", { name: "Setujui klaim" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Setujui klaim" }).click();
    await admin.getByText("Klaim disetujui.").waitFor();
    await admin.getByRole("button", { name: "Konfirmasi serah terima" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Ya, barang sudah diserahkan" }).click();
    await admin.getByText(/Serah terima tercatat/).waitFor();
    await loser.goto(`${BASE}/klaim`);
    await loser.getByText("Disetujui").first().waitFor();
    await loser.getByText("Sudah dikembalikan").first().waitFor();
    await finder.goto(foundUrl);
    await finder.getByText("Sudah dikembalikan").first().waitFor();
    await shot(admin, "10-admin-klaim-selesai");
  });
  await step("riwayat status & log aktivitas mencatat seluruh alur", async () => {
    await admin.goto(`${BASE}/admin/laporan/${foundUrl.split("/").pop()}`);
    await admin.getByText("Riwayat status").waitFor();
    await admin.goto(`${BASE}/admin/log`);
    for (const t of ["Klaim diajukan", "Keputusan klaim", "Barang dikembalikan"]) assert.ok(await admin.getByRole("table").getByText(t).first().isVisible(), t);
    await shot(admin, "11-admin-log");
  });

  console.log("\nAdministrasi");
  await step("halaman admin termuat: pengguna, laporan, kategori, lokasi, statistik", async () => {
    for (const [path, h] of [["/admin/pengguna", "Manajemen Pengguna"], ["/admin/laporan", "Manajemen Laporan"], ["/admin/kategori", "Kategori Barang"],
      ["/admin/lokasi", "Lokasi Kampus"], ["/admin/statistik", "Statistik"], ["/admin/klaim", "Verifikasi Klaim"]] as const) {
      await admin.goto(BASE + path);
      await admin.getByRole("heading", { name: h, exact: true }).waitFor();
    }
    await admin.goto(`${BASE}/admin/statistik`); await shot(admin, "12-admin-statistik");
  });
  await step("ADMIN menambah kategori; nama duplikat ditolak; kategori nonaktif tidak muncul di form", async () => {
    await admin.goto(`${BASE}/admin/kategori`);
    await admin.getByRole("button", { name: "Tambah kategori" }).click();
    let dlg = admin.getByRole("dialog");
    await dlg.getByLabel("Nama kategori").fill("Alat Musik");
    await dlg.getByRole("button", { name: "Simpan" }).click();
    await admin.getByText("Kategori ditambahkan.").waitFor();
    await admin.getByRole("button", { name: "Tambah kategori" }).click();
    dlg = admin.getByRole("dialog");
    await dlg.getByLabel("Nama kategori").fill("Alat Musik");
    await dlg.getByRole("button", { name: "Simpan" }).click();
    await dlg.getByText(/sudah ada/).waitFor();
    await dlg.getByRole("button", { name: "Batal" }).click();
    const row = admin.getByRole("row", { name: /Alat Musik/ });
    await row.getByRole("button", { name: /Nonaktifkan/ }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Ya, nonaktifkan" }).click();
    await admin.getByText(/Data dinonaktifkan/).waitFor();
    await other.goto(`${BASE}/laporan/hilang/baru`);
    assert.equal(await other.getByLabel("Kategori").locator("option", { hasText: "Alat Musik" }).count(), 0);
  });
  await step("ADMIN memoderasi laporan: tolak => hilang dari publik; buka kembali", async () => {
    await loser.goto(`${BASE}/laporan-saya`);
    const lostHref = await loser.getByRole("link", { name: "Dompet kulit coklat" }).first().getAttribute("href");
    const id = lostHref!.split("/").pop();
    await admin.goto(`${BASE}/admin/laporan/${id}`);
    await admin.getByRole("button", { name: "Ubah status" }).click();
    const dlg = admin.getByRole("dialog");
    await dlg.getByLabel("Status baru").selectOption("REJECTED");
    await dlg.getByLabel("Alasan perubahan").fill("Laporan melanggar ketentuan kampus.");
    await dlg.getByRole("button", { name: "Simpan status" }).click();
    await admin.getByText("Status laporan diperbarui.").waitFor();
    // Catatan: dengan loading.tsx (skeleton streaming) status HTTP sudah 200 sebelum notFound() dilempar,
    // maka yang diuji adalah ISI respons: tidak boleh memuat data laporan, harus memuat UI "tidak ditemukan".
    for (const headers of [{}, { RSC: "1" }] as Record<string, string>[]) {
      const gone = await (await otherCtx.request.get(`${BASE}/barang/${id}`, { headers })).text();
      assert.ok(!gone.includes("Dompet kulit coklat"), "data laporan REJECTED bocor ke pengguna lain!");
      assert.ok(!gone.includes("Dewi Kehilangan"));
      assert.ok(/Halaman tidak ditemukan|NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/.test(gone), "respons harus berupa halaman tidak ditemukan");
    }
    await loser.goto(`${BASE}/notifikasi`);
    await loser.getByText("Status laporan Anda berubah").first().waitFor();
  });
  await step("akun ditangguhkan: sesi langsung tidak berlaku & tidak bisa login", async () => {
    await admin.goto(`${BASE}/admin/pengguna?q=Komang`);
    await admin.getByRole("button", { name: "Ubah status" }).first().click();
    const dlg = admin.getByRole("dialog");
    await dlg.getByLabel("Status akun").selectOption("SUSPENDED");
    await dlg.getByRole("button", { name: "Simpan status" }).click();
    await admin.getByText(/Status akun diperbarui/).waitFor();
    await other.goto(`${BASE}/dashboard`); await other.waitForURL("**/login");
    await other.getByText("Dosen", { exact: true }).click();
    await other.getByLabel(/^Nomor NIDN/).fill("0412068899");
    await other.getByLabel("Kata sandi").fill("Password123");
    await other.getByRole("button", { name: "Masuk" }).click();
    await other.getByText(/tidak aktif/).waitFor();
  });
  await step("logout menghapus sesi: cookie lama tidak dapat dipakai lagi", async () => {
    const cookies = await finderCtx.cookies();
    const sess = cookies.find((c) => c.name === "cf_session")!;
    assert.ok(sess.httpOnly, "cookie HttpOnly");
    await finder.getByRole("button", { name: "Menu akun" }).click();
    await finder.getByRole("menuitem", { name: "Keluar" }).click();
    await finder.waitForURL("**/login");
    const replay = await (await browser.newContext()).request.get(`${BASE}/dashboard`, { headers: { Cookie: `cf_session=${sess.value}` }, maxRedirects: 0 });
    assert.ok([301, 302, 303, 307, 308].includes(replay.status()), `sesi lama harus ditolak (status ${replay.status()})`);
    assert.ok((replay.headers()["location"] ?? "").includes("/login"));
  });

  console.log("\nResponsif (390px) & aksesibilitas dasar");
  await step("tampilan mobile: tidak ada overflow horizontal & menu drawer berfungsi", async () => {
    const mctx = await mk(390, 844);
    const p = await mctx.newPage(); watch(p, "mobile");
    await p.goto(`${BASE}/login`);
    await p.getByText("Mahasiswa", { exact: true }).click();
    await p.getByLabel(/^Nomor NIM/).fill("240030111");
    await p.getByLabel("Kata sandi").fill("Password123");
    await p.getByRole("button", { name: "Masuk" }).click();
    await p.waitForURL("**/dashboard");
    for (const path of ["/dashboard", "/barang-ditemukan", "/laporan-saya", "/rekomendasi", "/klaim", "/notifikasi", "/profil", "/laporan/hilang/baru"]) {
      await p.goto(BASE + path);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 1, `overflow horizontal ${over}px pada ${path}`);
    }
    await p.goto(`${BASE}/dashboard`);
    await p.getByRole("button", { name: "Buka menu" }).click();
    await p.getByRole("dialog", { name: "Menu navigasi" }).getByRole("link", { name: "Klaim Saya" }).click();
    await p.waitForURL("**/klaim");
    await p.goto(`${BASE}/barang-ditemukan`); await shot(p, "13-mobile-daftar");
    await p.goto(`${BASE}/dashboard`); await shot(p, "14-mobile-dashboard");
    const lp = await (await mk(390, 844)).newPage(); await lp.goto(`${BASE}/login`); await shot(lp, "15-mobile-login");
  });
  await step("semua input memiliki label; tidak ada galat JS/HTTP 5xx selama alur", async () => {
    const unlabeled = await loser.evaluate(() => [...document.querySelectorAll("input:not([type=hidden]):not([type=file]),select,textarea")].filter((el) => {
      const e = el as HTMLInputElement; return !e.labels?.length && !e.getAttribute("aria-label");
    }).length);
    assert.equal(unlabeled, 0);
    assert.deepEqual(consoleErrors, []);
  });

  await browser.close();
  console.log(`\n${passed} langkah lulus, ${failed} gagal.`);
  if (failed) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
