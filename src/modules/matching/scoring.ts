/**
 * Weighted Similarity Scoring (SKPL 2.10)
 *
 *   S = 0,30·K + 0,20·W + 0,20·L + 0,15·T + 0,15·D      (tiap skor atribut 0..1)
 *   Persentase = S × 100
 *
 * Bobot (30/20/20/15/15) berasal dari SKPL dan MASIH RANCANGAN AWAL: belum diuji empiris.
 *
 * ATURAN RINCI di bawah ini TIDAK didefinisikan SKPL dan merupakan ASUMSI implementasi
 * (lihat docs/ASSUMPTIONS.md, bagian "Algoritma pencocokan"):
 *   K  Kategori   : 1 bila category_id sama, selain itu 0.
 *   W  Warna      : kemiripan Jaccard atas himpunan warna dasar ternormalisasi
 *                   (alias Indonesia/Inggris, pewarna "tua/muda/gelap" diabaikan).
 *   L  Lokasi     : 1 bila location_id sama, selain itu 0 (tabel locations tidak punya
 *                   koordinat/hierarki, sehingga "kedekatan" parsial belum bisa dihitung).
 *   T  Tanggal    : 1 - (selisih hari / jendela), minimum 0. Laporan FOUND yang bertanggal
 *                   >1 hari SEBELUM laporan LOST dianggap tidak logis => 0.
 *   D  Deskripsi  : koefisien Dice atas himpunan kata (nama + deskripsi) setelah
 *                   normalisasi dan penghapusan kata henti.
 */

export const WEIGHTS = { category: 0.3, color: 0.2, location: 0.2, date: 0.15, description: 0.15 } as const;

export interface Matchable {
  categoryId: number;
  locationId: number;
  color: string | null;
  incidentDate: string; // YYYY-MM-DD
  itemName: string;
  description: string | null;
}

export interface ScoreBreakdown {
  category: number;
  color: number;
  location: number;
  date: number;
  description: number;
  /** Persentase 0..100, 2 desimal. */
  total: number;
}

// ---------- Warna ----------
const COLOR_ALIASES: Record<string, string> = {
  hitam: "hitam", black: "hitam", putih: "putih", white: "putih",
  merah: "merah", red: "merah", maroon: "merah", marun: "merah",
  biru: "biru", blue: "biru", navy: "biru", dongker: "biru", tosca: "biru", turkis: "biru",
  hijau: "hijau", green: "hijau",
  kuning: "kuning", yellow: "kuning",
  oranye: "oranye", orange: "oranye", jingga: "oranye",
  ungu: "ungu", purple: "ungu", violet: "ungu", lavender: "ungu",
  pink: "pink", jambu: "pink",
  coklat: "coklat", cokelat: "coklat", brown: "coklat",
  abu: "abu", abuabu: "abu", grey: "abu", gray: "abu",
  perak: "perak", silver: "perak",
  emas: "emas", gold: "emas", keemasan: "emas",
  krem: "krem", cream: "krem", beige: "krem",
  transparan: "transparan", bening: "transparan", clear: "transparan",
};

export function normalizeColors(raw: string | null): Set<string> {
  if (!raw) return new Set();
  const text = raw
    .toLowerCase()
    .replace(/merah\s+muda/g, "pink")
    .replace(/abu-abu/g, "abu")
    .replace(/[^a-z\s]/g, " ");
  const out = new Set<string>();
  for (const tok of text.split(/\s+/)) if (tok && COLOR_ALIASES[tok]) out.add(COLOR_ALIASES[tok]);
  return out;
}

export function scoreColor(a: string | null, b: string | null): number {
  const A = normalizeColors(a), B = normalizeColors(b);
  if (A.size === 0 || B.size === 0) {
    // Warna tak dikenali: bandingkan teks apa adanya (hanya kecocokan persis yang dihitung).
    const x = (a ?? "").trim().toLowerCase(), y = (b ?? "").trim().toLowerCase();
    return x && x === y ? 1 : 0;
  }
  let inter = 0;
  for (const c of A) if (B.has(c)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---------- Tanggal ----------
function dayNumber(d: string): number {
  return Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86_400_000);
}

/** Selisih hari (found - lost). */
export function scoreDate(lostDate: string, foundDate: string, windowDays: number): number {
  const diff = dayNumber(foundDate) - dayNumber(lostDate);
  if (diff < -1) return 0;
  return Math.max(0, 1 - Math.max(diff, 0) / windowDays);
}

// ---------- Deskripsi ----------
const STOPWORDS = new Set(
  ("yang dan di ke dari pada untuk dengan atau itu ini saya aku ada adalah telah sudah belum tidak " +
    "juga akan oleh dalam saat ketika barang hilang ditemukan ditinggal tertinggal milik nya " +
    "the and a an of in on at for with lost found item").split(" "),
);

export function tokenize(text: string | null): Set<string> {
  if (!text) return new Set();
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const out = new Set<string>();
  for (const t of norm.split(/\s+/)) if (t.length >= 3 && !STOPWORDS.has(t)) out.add(t);
  return out;
}

export function scoreDescription(
  a: Pick<Matchable, "itemName" | "description">,
  b: Pick<Matchable, "itemName" | "description">,
): number {
  const A = tokenize(`${a.itemName} ${a.description ?? ""}`);
  const B = tokenize(`${b.itemName} ${b.description ?? ""}`);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// ---------- Total ----------
export function computeSimilarity(lost: Matchable, found: Matchable, windowDays: number): ScoreBreakdown {
  const category = lost.categoryId === found.categoryId ? 1 : 0;
  const color = scoreColor(lost.color, found.color);
  const location = lost.locationId === found.locationId ? 1 : 0;
  const date = scoreDate(lost.incidentDate, found.incidentDate, windowDays);
  const description = scoreDescription(lost, found);
  const s =
    WEIGHTS.category * category + WEIGHTS.color * color + WEIGHTS.location * location +
    WEIGHTS.date * date + WEIGHTS.description * description;
  return { category, color, location, date, description, total: Math.round(s * 10000) / 100 };
}
