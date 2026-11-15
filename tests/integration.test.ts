/**
 * Integration test: layanan domain vs MySQL sungguhan (database terpisah campusfind_test).
 * Jalankan: npm run test:integration   (lihat package.json untuk setup DB uji)
 */
import "../scripts/_env";
import assert from "node:assert/strict";
import { pool, query, queryOne, exec } from "../src/lib/db";
import { authenticate, registerUser, RegisterError } from "../src/modules/auth/service";
import { createItem, updateItem, getItemDetail, listItems, adminChangeItemStatus, closeOwnItem, ItemError, getItemHistory } from "../src/modules/items/service";
import { listMatchesForUser, dismissMatch } from "../src/modules/matching/service";
import { submitClaim, cancelClaim, respondToNeedInfo, decideClaim, confirmHandover, getEvidenceKeyFor, getClaimForAdmin, listClaimsForUser, ClaimError } from "../src/modules/claims/service";
import { changeAccountStatus, AdminError } from "../src/modules/admin/users";
import { createMaster, setMasterActive, listMaster, updateMaster } from "../src/modules/admin/master";
import { getStats } from "../src/modules/admin/stats";
import { listAuditLogs } from "../src/modules/admin/logs";
import { listNotifications, unreadCount, markRead, markAllRead } from "../src/modules/notifications/service";
import { saveUpload, readStored, UploadError } from "../src/lib/uploads";
import { todayLocal } from "../src/lib/utils";
import type { SessionUser } from "../src/lib/types";

if (!process.env.DB_NAME?.endsWith("_test")) throw new Error("Tolak: test integrasi hanya boleh berjalan pada database *_test.");

let n = 0;
async function t(name: string, fn: () => Promise<void>) {
  try { await fn(); n++; console.log("  ok -", name); }
  catch (e) { console.error("  GAGAL -", name, "\n   ", (e as Error).message); process.exitCode = 1; }
}
async function rejects(fn: () => Promise<unknown>, ctor: new (...a: never[]) => Error, msg?: RegExp) {
  try { await fn(); } catch (e) {
    assert.ok(e instanceof ctor, `error bertipe ${ctor.name}, diterima ${(e as Error)?.constructor?.name}: ${(e as Error).message}`);
    if (msg) assert.match((e as Error).message, msg);
    return;
  }
  assert.fail("seharusnya melempar error");
}
const asUser = async (id: number): Promise<SessionUser> => {
  const r = (await queryOne<Record<string, never>>("SELECT * FROM users WHERE user_id = ?", [id]))!;
  return { userId: id, role: r.role, userType: r.user_type, fullName: r.full_name, email: r.email, username: r.username,
    identityType: r.identity_type, identityNumber: r.identity_number, phoneNumber: r.phone_number, accountStatus: r.account_status };
};

const SECRET = "RAHASIA-GORESAN-INISIAL-XYZ123";
const today = todayLocal();

async function main() {
  // --- bersihkan & siapkan
  await exec("SET FOREIGN_KEY_CHECKS=0");
  for (const t of ["audit_logs","sessions","item_status_histories","notifications","claims","item_matches","items"]) await exec(`TRUNCATE TABLE ${t}`);
  await exec("DELETE FROM users WHERE role='USER'");
  await exec("SET FOREIGN_KEY_CHECKS=1");
  const adminRow = await queryOne<{ user_id: number }>("SELECT user_id FROM users WHERE role='ADMIN' LIMIT 1");
  assert.ok(adminRow, "jalankan db:seed pada database uji terlebih dahulu");
  const admin = await asUser(adminRow.user_id);
  const cat = (await query<{ category_id: number }>("SELECT category_id FROM categories ORDER BY category_id LIMIT 2"));
  const loc = (await query<{ location_id: number }>("SELECT location_id FROM locations ORDER BY location_id LIMIT 2"));

  console.log("\nAutentikasi (FR-01..06, NFR-01)");
  const finderId = await registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030001", fullName: "Penemu Satu", email: "penemu@test.id", phoneNumber: null, password: "Password123" });
  const loserId = await registerUser({ userType: "LECTURER", identityType: "NIDN", identityNumber: "0011223344", fullName: "Dosen Kehilangan", email: "dosen@test.id", phoneNumber: "08123456789", password: "Password123" });
  const otherId = await registerUser({ userType: "STAFF", identityType: "NIP", identityNumber: "198001012010", fullName: "Staf Lain", email: "staf@test.id", phoneNumber: null, password: "Password123" });
  const finder = await asUser(finderId), loser = await asUser(loserId), other = await asUser(otherId);

  await t("password tersimpan sebagai Argon2id", async () => {
    const r = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE user_id = ?", [finderId]);
    assert.match(r!.password_hash, /^\$argon2id\$/);
    assert.ok(!r!.password_hash.includes("Password123"));
  });
  await t("login USER benar (NIM) berhasil, role dari DB", async () => {
    const r = await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "240030001", password: "Password123" }, "1.1.1.1");
    assert.deepEqual(r, { ok: true, userId: finderId, role: "USER" });
  });
  await t("login ADMIN via username berhasil", async () => {
    const r = await authenticate({ accountType: "ADMIN", username: "admin", password: process.env.SEED_ADMIN_PASSWORD! }, "1.1.1.2");
    assert.ok(r.ok && r.role === "ADMIN");
  });
  await t("USER tidak bisa masuk lewat jalur ADMIN, ADMIN tidak lewat jalur USER", async () => {
    assert.equal((await authenticate({ accountType: "ADMIN", username: "240030001", password: "Password123" }, "1.1.1.3")).ok, false);
    assert.equal((await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "admin", password: process.env.SEED_ADMIN_PASSWORD! }, "1.1.1.4")).ok, false);
  });
  await t("kata sandi salah & identitas tak dikenal => pesan generik sama", async () => {
    const a = await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "240030001", password: "salah" }, "2.2.2.1");
    const b = await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "999999999", password: "salah" }, "2.2.2.2");
    assert.ok(!a.ok && !b.ok && a.message === b.message);
  });
  await t("pembatasan percobaan login: blokir setelah 5 kegagalan", async () => {
    let last;
    for (let i = 0; i < 7; i++) last = await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "240030001", password: "x" + i }, "3.3.3.3");
    assert.ok(last && !last.ok && /Terlalu banyak/.test(last.message));
    const correct = await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "240030001", password: "Password123" }, "3.3.3.3");
    assert.ok(!correct.ok, "akun terkunci sementara walau kata sandi benar");
  });
  await t("registrasi: identitas & email duplikat ditolak", async () => {
    await rejects(() => registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030001", fullName: "Dup", email: "lain@test.id", phoneNumber: null, password: "Password123" }), RegisterError, /identitas/i);
    await rejects(() => registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030999", fullName: "Dup", email: "penemu@test.id", phoneNumber: null, password: "Password123" }), RegisterError, /Email/);
  });
  await t("DB menolak kombinasi user_type/identity_type yang melanggar BR-04 (CHECK)", async () => {
    await assert.rejects(() => exec("INSERT INTO users (identity_type, identity_number, user_type, full_name, email, password_hash, role) VALUES ('NIDN','1234567','STUDENT','x','x@x.id','h','USER')"));
    await assert.rejects(() => exec("INSERT INTO users (full_name, email, password_hash, role) VALUES ('x','y@y.id','h','USER')"));
  });
  await t("akun SUSPENDED tidak dapat masuk; sesi dicabut", async () => {
    const tmp = await registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030777", fullName: "Tmp", email: "tmp@test.id", phoneNumber: null, password: "Password123" });
    await exec("INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))", ["a".repeat(64), tmp]);
    await changeAccountStatus(admin, tmp, "SUSPENDED", "uji");
    assert.equal((await query("SELECT 1 FROM sessions WHERE user_id = ?", [tmp])).length, 0);
    const r = await authenticate({ accountType: "USER", userType: "STUDENT", identityType: "NIM", identityNumber: "240030777", password: "Password123" }, "4.4.4.4");
    assert.ok(!r.ok && /tidak aktif/.test(r.message));
  });
  await t("admin tidak dapat mengubah status akunnya sendiri; non-admin ditolak", async () => {
    await rejects(() => changeAccountStatus(admin, admin.userId, "INACTIVE", null), AdminError);
    await rejects(() => changeAccountStatus(finder, loserId, "INACTIVE", null), AdminError);
  });

  console.log("\nLaporan, privasi, pencarian (FR-08..12, FR-33)");
  let lostId = 0, foundId = 0;
  await t("buat LOST & FOUND mirip => pencocokan otomatis tersimpan + notifikasi kedua pemilik", async () => {
    lostId = await createItem(loser, { itemType: "LOST", itemName: "Dompet kulit coklat", categoryId: cat[0].category_id, locationId: loc[0].location_id, color: "Coklat", description: "Dompet kulit coklat berisi kartu ATM dan KTP", incidentDate: today, privateIdentifier: null }, null);
    foundId = await createItem(finder, { itemType: "FOUND", itemName: "Dompet kulit", categoryId: cat[0].category_id, locationId: loc[0].location_id, color: "cokelat", description: "Dompet kulit warna cokelat ditemukan di lantai", incidentDate: today, privateIdentifier: `Ada ${SECRET} di dalam lipatan` }, null);
    const m = await query<{ similarity_score: number; match_status: string; lost_item_id: number; found_item_id: number }>("SELECT * FROM item_matches");
    assert.equal(m.length, 1);
    assert.equal(m[0].lost_item_id, lostId); assert.equal(m[0].found_item_id, foundId);
    assert.equal(m[0].match_status, "SUGGESTED");
    assert.ok(m[0].similarity_score >= 50 && m[0].similarity_score <= 100, `skor ${m[0].similarity_score}`);
    assert.ok((await unreadCount(loserId)) >= 1 && (await unreadCount(finderId)) >= 1);
  });
  await t("riwayat status awal tercatat (FR-25)", async () => {
    const h = await getItemHistory(foundId, admin);
    assert.equal(h.length, 1); assert.equal(h[0].newStatus, "OPEN"); assert.equal(h[0].oldStatus, null);
  });
  await t("private_identifier TIDAK bocor ke pengguna lain (detail & daftar)", async () => {
    const d = await getItemDetail(foundId, other);
    assert.ok(d && d.privateIdentifier === null && d.userId === null && d.reporterName === null && d.reporterEmail === null);
    assert.ok(!JSON.stringify(d).includes(SECRET));
    const list = await listItems("public", other, {});
    assert.ok(!JSON.stringify(list).includes(SECRET));
    const matches = await listMatchesForUser(loserId);
    assert.ok(matches.length === 1 && !JSON.stringify(matches).includes(SECRET));
    assert.ok(!("userId" in matches[0].other));
  });
  await t("pemilik & admin dapat melihat private_identifier", async () => {
    assert.ok((await getItemDetail(foundId, finder))!.privateIdentifier!.includes(SECRET));
    const a = (await getItemDetail(foundId, admin))!;
    assert.ok(a.privateIdentifier!.includes(SECRET)); assert.equal(a.reporterName, "Penemu Satu");
  });
  await t("pencarian: kata kunci, filter, wildcard LIKE diperlakukan literal", async () => {
    assert.equal((await listItems("public", other, { q: "dompet" })).total, 2);
    assert.equal((await listItems("public", other, { type: "FOUND" })).total, 1);
    assert.equal((await listItems("public", other, { categoryId: cat[1].category_id })).total, 0);
    assert.equal((await listItems("public", other, { q: "%" })).total, 0);
    assert.equal((await listItems("public", other, { q: "dompet'; DROP TABLE items;--" })).total, 0);
    assert.equal((await query("SELECT 1 FROM items")).length, 2);
    assert.equal((await listItems("mine", loser, {})).total, 1);
  });
  await t("filter rentang tanggal (FR-11) membatasi hasil", async () => {
    assert.equal((await listItems("public", other, { dateFrom: "2099-01-01" })).total, 0);
    assert.equal((await listItems("public", other, { dateTo: "2020-01-02" })).total, 0);
    assert.ok((await listItems("public", other, { dateFrom: today, dateTo: today })).total >= 2);
  });
  await t("laporan REJECTED tidak terlihat pengguna lain tetapi terlihat pemilik/admin", async () => {
    const id = await createItem(finder, { itemType: "FOUND", itemName: "Payung hitam", categoryId: cat[1].category_id, locationId: loc[1].location_id, color: "hitam", description: "Payung lipat hitam tertinggal", incidentDate: today, privateIdentifier: "gagang patah" }, null);
    await adminChangeItemStatus(admin, id, "REJECTED", "Laporan tidak sesuai ketentuan");
    assert.equal(await getItemDetail(id, other), null);
    assert.ok(await getItemDetail(id, finder)); assert.ok(await getItemDetail(id, admin));
    assert.equal((await listItems("public", other, { q: "payung" })).total, 0);
    await adminChangeItemStatus(admin, id, "OPEN", "Dibuka kembali");
    assert.ok(await getItemDetail(id, other));
    await rejects(() => adminChangeItemStatus(loser, id, "CLOSED", "bukan admin"), ItemError);
  });
  await t("update laporan memicu pencocokan ulang; skor di bawah ambang menghapus rekomendasi SUGGESTED", async () => {
    await updateItem(loser, lostId, { itemName: "Payung biru", categoryId: cat[1].category_id, locationId: loc[1].location_id, color: "biru", description: "Payung besar biru garis putih", incidentDate: "2026-01-02", privateIdentifier: null }, { newPhotoKey: null, removePhoto: false });
    assert.equal((await query("SELECT 1 FROM item_matches WHERE lost_item_id = ? AND found_item_id = ?", [lostId, foundId])).length, 0);
    await updateItem(loser, lostId, { itemName: "Dompet kulit coklat", categoryId: cat[0].category_id, locationId: loc[0].location_id, color: "Coklat", description: "Dompet kulit coklat berisi kartu ATM dan KTP", incidentDate: today, privateIdentifier: null }, { newPhotoKey: null, removePhoto: false });
    assert.equal((await query("SELECT 1 FROM item_matches WHERE lost_item_id = ? AND found_item_id = ?", [lostId, foundId])).length, 1);
  });
  await t("hanya pemilik yang dapat mengubah/menutup laporan", async () => {
    await rejects(() => updateItem(other, lostId, { itemName: "x y z", categoryId: cat[0].category_id, locationId: loc[0].location_id, color: "hitam", description: "deskripsi panjang cukup", incidentDate: today, privateIdentifier: null }, { newPhotoKey: null, removePhoto: false }), ItemError);
    await rejects(() => closeOwnItem(other, lostId), ItemError);
  });
  await t("kategori/lokasi nonaktif tidak bisa dipakai laporan baru; data master tidak dihapus", async () => {
    const id = await createMaster(admin, "category", "Kategori Uji", null);
    await rejects(() => createMaster(admin, "category", "Kategori Uji", null), AdminError, /sudah ada/);
    await setMasterActive(admin, "category", id, false);
    await rejects(() => createItem(finder, { itemType: "LOST", itemName: "Barang uji", categoryId: id, locationId: loc[0].location_id, color: "hitam", description: "deskripsi uji cukup panjang", incidentDate: today, privateIdentifier: null }, null), ItemError, /Kategori/);
    assert.ok((await listMaster("category")).some((c) => c.id === id && !c.isActive));
    await updateMaster(admin, "category", id, "Kategori Uji Diubah", "deskripsi baru");
    await setMasterActive(admin, "category", id, true);
    const row = (await listMaster("category")).find((c) => c.id === id)!;
    assert.deepEqual([row.name, row.description, row.isActive], ["Kategori Uji Diubah", "deskripsi baru", true]);
    await rejects(() => updateMaster(loser, "category", id, "x y", null), AdminError);
  });

  console.log("\nKlaim (FR-17..20, FR-28, FR-29, BR-07, BR-09)");
  let claimId = 0;
  await t("ajukan klaim: item OPEN -> CLAIM_PENDING, riwayat & audit tercatat", async () => {
    claimId = await submitClaim(loser, foundId, "Dompet itu milik saya, ada goresan inisial di lipatan dalam.", null);
    assert.equal((await queryOne<{ item_status: string }>("SELECT item_status FROM items WHERE item_id = ?", [foundId]))!.item_status, "CLAIM_PENDING");
    const h = await getItemHistory(foundId, admin);
    assert.equal(h.at(-1)!.newStatus, "CLAIM_PENDING");
    assert.ok((await query("SELECT 1 FROM audit_logs WHERE action='CLAIM_SUBMITTED'")).length === 1);
  });
  await t("klaim ganda pada item yang sama & klaim atas laporan sendiri ditolak", async () => {
    await rejects(() => submitClaim(other, foundId, "Saya juga merasa ini milik saya, catatan cukup panjang.", null), ClaimError, /tidak dapat diklaim/);
    await rejects(() => submitClaim(finder, foundId, "Mengklaim laporan sendiri, catatan cukup panjang.", null), ClaimError);
  });
  await t("klaim atas laporan LOST ditolak (BR-09)", async () => {
    await rejects(() => submitClaim(other, lostId, "Mengklaim laporan kehilangan, catatan cukup panjang.", null), ClaimError, /ditemukan/);
  });
  await t("race condition: 5 klaim serentak pada item OPEN => tepat 1 berhasil (NFR-17)", async () => {
    const id = await createItem(finder, { itemType: "FOUND", itemName: "Kunci motor", categoryId: cat[1].category_id, locationId: loc[1].location_id, color: "hitam", description: "Kunci motor gantungan hitam", incidentDate: today, privateIdentifier: "gantungan boneka" }, null);
    const claimants = [loser, other, await asUser(await registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030002", fullName: "C2", email: "c2@test.id", phoneNumber: null, password: "Password123" })),
      await asUser(await registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030003", fullName: "C3", email: "c3@test.id", phoneNumber: null, password: "Password123" })),
      await asUser(await registerUser({ userType: "STUDENT", identityType: "NIM", identityNumber: "240030004", fullName: "C4", email: "c4@test.id", phoneNumber: null, password: "Password123" }))];
    const res = await Promise.allSettled(claimants.map((u) => submitClaim(u, id, "Kunci ini milik saya, catatan klaim cukup panjang.", null)));
    assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await query("SELECT 1 FROM claims WHERE item_id = ? AND claim_status='PENDING'", [id])).length, 1);
  });
  await t("hanya pengaju yang dapat membatalkan; batal => item OPEN kembali (FR-28)", async () => {
    await rejects(() => cancelClaim(other, claimId), ClaimError);
    await cancelClaim(loser, claimId);
    assert.equal((await queryOne<{ item_status: string }>("SELECT item_status FROM items WHERE item_id = ?", [foundId]))!.item_status, "OPEN");
    await rejects(() => cancelClaim(loser, claimId), ClaimError, /dibatalkan selama/);
    claimId = await submitClaim(loser, foundId, "Mengajukan ulang klaim: ada goresan inisial di dalam lipatan.", null);
  });
  await t("non-admin tidak dapat memutuskan klaim (BR-07)", async () => {
    await rejects(() => decideClaim(loser, claimId, "APPROVED", null), ClaimError);
    await rejects(() => decideClaim(finder, claimId, "APPROVED", null), ClaimError);
  });
  await t("admin meminta bukti tambahan; pengaju melengkapi; kembali PENDING", async () => {
    await decideClaim(admin, claimId, "NEED_INFO", "Sebutkan ciri khusus yang ada di dalam dompet.");
    assert.equal((await queryOne<{ claim_status: string }>("SELECT claim_status FROM claims WHERE claim_id=?", [claimId]))!.claim_status, "NEED_INFO");
    await rejects(() => cancelClaim(loser, claimId), ClaimError);
    await rejects(() => decideClaim(admin, claimId, "APPROVED", null), ClaimError, /tidak dapat diputuskan/);
    await respondToNeedInfo(loser, claimId, `Goresan inisial: ${SECRET}`, null);
    const c = await getClaimForAdmin(admin, claimId);
    assert.equal(c!.claimStatus, "PENDING"); assert.ok(c!.claimNote.includes(SECRET));
  });
  await t("data klaim/ciri khusus hanya dapat dibaca admin lewat service admin", async () => {
    await rejects(() => getClaimForAdmin(loser, claimId), ClaimError);
    assert.equal(await getEvidenceKeyFor(other, claimId), null);
  });
  await t("admin menyetujui => match CONFIRMED, item tetap CLAIM_PENDING, notifikasi ke pengaju", async () => {
    await decideClaim(admin, claimId, "APPROVED", "Ciri khusus cocok.");
    assert.equal((await queryOne<{ item_status: string }>("SELECT item_status FROM items WHERE item_id=?", [foundId]))!.item_status, "CLAIM_PENDING");
    assert.equal((await queryOne<{ match_status: string }>("SELECT match_status FROM item_matches WHERE found_item_id=?", [foundId]))!.match_status, "CONFIRMED");
    const n = await listNotifications(loserId, {});
    assert.ok(n.rows.some((r) => r.title === "Klaim Anda disetujui"));
    const mine = await listClaimsForUser(loserId);
    assert.equal(mine[0].claimStatus, "APPROVED"); assert.equal(mine[0].adminNote, "Ciri khusus cocok.");
  });
  await t("serah terima: item RETURNED, status final; riwayat lengkap & audit keputusan (FR-25, FR-32, BR-12)", async () => {
    await confirmHandover(admin, claimId);
    assert.equal((await queryOne<{ item_status: string }>("SELECT item_status FROM items WHERE item_id=?", [foundId]))!.item_status, "RETURNED");
    await rejects(() => confirmHandover(admin, claimId), ClaimError);
    await rejects(() => adminChangeItemStatus(admin, foundId, "OPEN", "uji"), ItemError, /dikembalikan/);
    const statuses = (await getItemHistory(foundId, admin)).map((h) => h.newStatus);
    assert.deepEqual(statuses, ["OPEN", "CLAIM_PENDING", "OPEN", "CLAIM_PENDING", "RETURNED"]);
    const logs = await listAuditLogs(admin, {});
    for (const a of ["CLAIM_SUBMITTED", "CLAIM_CANCELLED", "CLAIM_DECISION", "ITEM_RETURNED", "ITEM_STATUS_CHANGED", "USER_STATUS_CHANGED"])
      assert.ok(logs.actions.includes(a), `audit ${a}`);
  });
  await t("penolakan klaim membuka kembali laporan", async () => {
    const id = await createItem(finder, { itemType: "FOUND", itemName: "Jam tangan", categoryId: cat[1].category_id, locationId: loc[1].location_id, color: "perak", description: "Jam tangan perak ditemukan di kantin", incidentDate: today, privateIdentifier: "ukiran huruf R" }, null);
    const cid = await submitClaim(other, id, "Jam tangan itu punya saya, catatan klaim cukup panjang.", null);
    await rejects(() => decideClaim(admin, cid, "REJECTED", "singkat"), ClaimError, /wajib diisi/);
    await rejects(() => decideClaim(admin, cid, "REJECTED", null), ClaimError, /wajib diisi/);
    assert.equal((await queryOne<{ claim_status: string }>("SELECT claim_status FROM claims WHERE claim_id=?", [cid]))!.claim_status, "PENDING");
    await decideClaim(admin, cid, "REJECTED", "Ciri khusus tidak cocok dengan laporan.");
    assert.equal((await queryOne<{ item_status: string }>("SELECT item_status FROM items WHERE item_id=?", [id]))!.item_status, "OPEN");
    assert.ok((await submitClaim(loser, id, "Saya pemilik jam tangan ini, catatan cukup panjang.", null)) > 0);
  });

  console.log("\nNotifikasi, statistik");
  await t("notifikasi: tandai dibaca hanya milik sendiri (FR-30)", async () => {
    const mine = (await listNotifications(loserId, { onlyUnread: true })).rows[0];
    assert.equal(await markRead(otherId, mine.notification_id), false);
    assert.equal(await markRead(loserId, mine.notification_id), true);
    await markAllRead(loserId);
    assert.equal(await unreadCount(loserId), 0);
  });
  await t("rekomendasi dapat diabaikan hanya oleh pemilik salah satu laporan", async () => {
    const id = await createItem(loser, { itemType: "LOST", itemName: "Kunci motor", categoryId: cat[1].category_id, locationId: loc[1].location_id, color: "hitam", description: "Kunci motor gantungan hitam", incidentDate: today, privateIdentifier: null }, null);
    const m = (await listMatchesForUser(loserId, { itemId: id }));
    if (m.length) {
      assert.equal(await dismissMatch(otherId, m[0].matchId), false);
      assert.equal(await dismissMatch(loserId, m[0].matchId), true);
      assert.ok(!(await listMatchesForUser(loserId, { itemId: id })).some((x) => x.matchId === m[0].matchId));
      assert.equal(await dismissMatch(loserId, m[0].matchId), false, "tidak dapat diabaikan dua kali");
    } else assert.fail("seharusnya ada rekomendasi untuk laporan Kunci motor");
  });
  await t("statistik konsisten dengan data (FR-26)", async () => {
    const s = await getStats(admin);
    assert.equal(s.totals.items, s.totals.lost + s.totals.found);
    assert.equal(s.itemsByStatus.reduce((a, r) => a + r.count, 0), s.totals.items);
    assert.equal(s.claimsByStatus.reduce((a, r) => a + r.count, 0), s.totals.claims);
    await rejects(() => getStats(loser), AdminError);
  });

  console.log("\nUpload aman (NFR-14)");
  const mk = (bytes: number[] | Buffer, name: string, type: string, pad = 64) => new File([Buffer.concat([Buffer.from(bytes), Buffer.alloc(pad)])], name, { type });
  await t("PNG asli diterima; disimpan dengan nama acak, dapat dibaca kembali", async () => {
    const key = await saveUpload(mk([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "../../etc/passwd.png", "image/png"), "photo");
    assert.match(key!, /^photos\/[0-9a-f-]{36}\.png$/);
    assert.equal((await readStored(key!))!.mime, "image/png");
    assert.equal(await readStored("photos/../../package.json"), null);
  });
  await t("berkas palsu (teks/HTML/SVG berekstensi gambar) ditolak berdasar isi", async () => {
    await rejects(() => saveUpload(mk(Buffer.from("<html><script>alert(1)</script></html>"), "x.jpg", "image/jpeg"), "photo"), UploadError);
    await rejects(() => saveUpload(mk(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.png", "image/png"), "photo"), UploadError);
  });
  await t("PDF ditolak untuk foto tetapi diterima untuk bukti klaim; ukuran berlebih ditolak", async () => {
    const pdf = mk(Buffer.from("%PDF-1.4\n"), "bukti.pdf", "application/pdf");
    await rejects(() => saveUpload(pdf, "photo"), UploadError);
    assert.match((await saveUpload(pdf, "evidence"))!, /^evidence\/.+\.pdf$/);
    await rejects(() => saveUpload(mk([0xff, 0xd8, 0xff], "big.jpg", "image/jpeg", 4 * 1024 * 1024), "photo"), UploadError, /maksimal/);
    assert.equal(await saveUpload(null, "photo"), null);
  });

  console.log(`\n${n} pengujian lulus${process.exitCode ? " (ADA YANG GAGAL)" : ""}.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
