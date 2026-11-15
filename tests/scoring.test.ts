import assert from "node:assert/strict";
import { computeSimilarity, normalizeColors, scoreColor, scoreDate, scoreDescription, WEIGHTS } from "../src/modules/matching/scoring";

let passed = 0;
function t(name: string, fn: () => void) { fn(); passed++; console.log("  ok -", name); }
const close = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

console.log("Weighted Similarity Scoring");
t("bobot berjumlah 1,00 dan sesuai SKPL", () => {
  close(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 1);
  assert.deepEqual(WEIGHTS, { category: 0.3, color: 0.2, location: 0.2, date: 0.15, description: 0.15 });
});
t("warna: alias ID/EN dan pewarna diabaikan", () => {
  assert.deepEqual([...normalizeColors("Hitam")], ["hitam"]);
  assert.deepEqual([...normalizeColors("Black")], ["hitam"]);
  assert.deepEqual([...normalizeColors("biru tua")], ["biru"]);
  assert.deepEqual([...normalizeColors("merah muda")], ["pink"]);
  close(scoreColor("Hitam", "black"), 1);
  close(scoreColor("hitam putih", "hitam"), 0.5);
  close(scoreColor("merah", "biru"), 0);
  close(scoreColor(null, "biru"), 0);
});
t("tanggal: sama=1, linear, di luar jendela=0, found sebelum lost=0", () => {
  close(scoreDate("2026-11-01", "2026-11-01", 14), 1);
  close(scoreDate("2026-11-01", "2026-11-08", 14), 0.5);
  close(scoreDate("2026-11-01", "2026-11-20", 14), 0);
  close(scoreDate("2026-11-05", "2026-11-04", 14), 1); // toleransi 1 hari
  close(scoreDate("2026-11-05", "2026-11-01", 14), 0);
});
t("deskripsi: Dice atas kata bermakna", () => {
  const a = { itemName: "Dompet kulit", description: "Dompet kulit warna coklat berisi kartu" };
  assert.ok(scoreDescription(a, a) > 0.99);
  assert.equal(scoreDescription(a, { itemName: "Payung", description: "Payung lipat" }), 0);
});
t("total: identik pada semua atribut = 100%", () => {
  const x = { categoryId: 1, locationId: 2, color: "hitam", incidentDate: "2026-11-01", itemName: "Tas ransel", description: "Tas ransel hitam merk eiger" };
  close(computeSimilarity(x, x, 14).total, 100);
});
t("total: hanya kategori+lokasi sama = 50% (0,30+0,20)", () => {
  const lost = { categoryId: 1, locationId: 2, color: "merah", incidentDate: "2026-01-01", itemName: "aaa bbb", description: "ccc ddd" };
  const found = { categoryId: 1, locationId: 2, color: "biru", incidentDate: "2026-06-01", itemName: "eee fff", description: "ggg hhh" };
  close(computeSimilarity(lost, found, 14).total, 50);
});
t("total: kategori beda, selebihnya identik = 70%", () => {
  const lost = { categoryId: 1, locationId: 2, color: "hitam", incidentDate: "2026-11-01", itemName: "tas ransel", description: "ransel hitam eiger" };
  const found = { ...lost, categoryId: 9 };
  close(computeSimilarity(lost, found, 14).total, 70);
});
console.log(`\n${passed} pengujian lulus.`);
