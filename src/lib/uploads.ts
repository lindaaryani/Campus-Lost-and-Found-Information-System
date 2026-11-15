import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";

/**
 * Penanganan upload aman (NFR-14):
 *  - jenis berkas ditentukan dari "magic bytes", BUKAN dari nama/Content-Type kiriman klien;
 *  - hanya JPEG/PNG/WebP (foto) dan + PDF (bukti klaim); SVG/HTML ditolak;
 *  - ukuran dibatasi; nama berkas disimpan acak (UUID) sehingga tidak ada path traversal;
 *  - berkas disimpan di luar folder `public` dan disajikan lewat route terotorisasi.
 */
export type UploadKind = "photo" | "evidence";
type Detected = { ext: "jpg" | "png" | "webp" | "pdf"; mime: string };

function detect(buf: Buffer): Detected | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: "png", mime: "image/png" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return { ext: "webp", mime: "image/webp" };
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return { ext: "pdf", mime: "application/pdf" };
  return null;
}

export class UploadError extends Error {}

/** Mengembalikan kunci penyimpanan relatif (mis. "photos/<uuid>.jpg") atau null bila tidak ada berkas. */
export async function saveUpload(file: File | null, kind: UploadKind): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const limit = kind === "photo" ? config.maxPhotoBytes : config.maxEvidenceBytes;
  if (file.size > limit) {
    throw new UploadError(`Ukuran berkas maksimal ${Math.round(limit / 1024 / 1024)} MB.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detect(buf);
  const allowed = kind === "photo" ? ["jpg", "png", "webp"] : ["jpg", "png", "webp", "pdf"];
  if (!type || !allowed.includes(type.ext)) {
    throw new UploadError(
      kind === "photo" ? "Format foto harus JPG, PNG, atau WebP." : "Format bukti harus JPG, PNG, WebP, atau PDF.",
    );
  }
  const dir = kind === "photo" ? "photos" : "evidence";
  const key = `${dir}/${randomUUID()}.${type.ext}`;
  const abs = path.join(config.storageDir, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf, { mode: 0o640 });
  return key;
}

/** Baca berkas berdasarkan kunci; menolak kunci yang keluar dari folder storage. */
export async function readStored(key: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^(photos|evidence)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(key)) return null;
  const abs = path.join(config.storageDir, key);
  if (!abs.startsWith(config.storageDir + path.sep)) return null;
  try {
    const data = await fs.readFile(abs);
    const d = detect(data);
    return d ? { data, mime: d.mime } : null;
  } catch {
    return null;
  }
}

export async function deleteStored(key: string | null): Promise<void> {
  if (!key || !/^(photos|evidence)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(key)) return;
  await fs.rm(path.join(config.storageDir, key), { force: true });
}
