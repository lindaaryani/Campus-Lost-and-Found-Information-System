import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Timestamp MySQL (UTC, "YYYY-MM-DD HH:mm:ss") -> Date. */
export function parseDbTimestamp(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: config.timeZone, day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
});

export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "-";
  return dateTimeFmt.format(parseDbTimestamp(ts)) + " WITA";
}

/** Kolom DATE ("YYYY-MM-DD") -> teks tanggal tanpa pergeseran zona waktu. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(new Date(d.slice(0, 10) + "T12:00:00Z"));
}

/** Tanggal hari ini di WITA, format YYYY-MM-DD (untuk atribut max pada input date). */
export function todayLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format(new Date());
  return parts; // en-CA => YYYY-MM-DD
}

export function relativeTime(ts: string): string {
  const diff = Date.now() - parseDbTimestamp(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return formatDate(ts.slice(0, 10));
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** Escape karakter wildcard LIKE agar kata kunci pengguna diperlakukan literal. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
