import path from "node:path";

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Konfigurasi terpusat; semua nilai berasal dari environment variable. */
export const config = {
  sessionCookie: "cf_session",
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 12),
  // Path storage ditentukan saat runtime (di luar folder public); sengaja tidak di-trace oleh bundler.
  storageDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR ?? "./storage"),
  maxPhotoBytes: num(process.env.MAX_PHOTO_MB, 3) * 1024 * 1024,
  maxEvidenceBytes: num(process.env.MAX_EVIDENCE_MB, 5) * 1024 * 1024,
  /** Ambang rekomendasi (persen). BELUM divalidasi empiris. */
  matchThreshold: num(process.env.MATCH_THRESHOLD, 50),
  matchDateWindowDays: num(process.env.MATCH_DATE_WINDOW_DAYS, 14),
  allowSelfRegistration: (process.env.ALLOW_SELF_REGISTRATION ?? "true") !== "false",
  pageSize: 12,
  timeZone: "Asia/Makassar", // WITA (Bali)
} as const;
