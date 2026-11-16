
import "server-only";
import { randomUUID } from "node:crypto";
import { supabase, storageBucket } from "./supabase";
import { config } from "./config";

/**
 * Penyimpanan upload privat menggunakan Supabase Storage.
 * Validasi format menggunakan magic bytes.
 */
export type UploadKind = "photo" | "evidence";

type Detected = {
  ext: "jpg" | "png" | "webp" | "pdf";
  mime: string;
};

function detect(buf: Buffer): Detected | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return { ext: "png", mime: "image/png" };
  }

  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }

  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { ext: "pdf", mime: "application/pdf" };
  }

  return null;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

const validKey = (key: string) =>
  /^(photos|evidence)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i.test(key);

/**
 * Menyimpan file ke bucket privat dan mengembalikan storage key.
 */
export async function saveUpload(
  file: File | null,
  kind: UploadKind,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const limit =
    kind === "photo" ? config.maxPhotoBytes : config.maxEvidenceBytes;

  if (file.size > limit) {
    throw new UploadError(
      `Ukuran berkas maksimal ${Math.round(limit / 1024 / 1024)} MB.`,
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = detect(buf);

  const allowed =
    kind === "photo"
      ? ["jpg", "png", "webp"]
      : ["jpg", "png", "webp", "pdf"];

  if (!type || !allowed.includes(type.ext)) {
    throw new UploadError(
      kind === "photo"
        ? "Format foto harus JPG, PNG, atau WebP."
        : "Format bukti harus JPG, PNG, WebP, atau PDF.",
    );
  }

  const key = `${
    kind === "photo" ? "photos" : "evidence"
  }/${randomUUID()}.${type.ext}`;

  const { error } = await supabase.storage
  .from(storageBucket)
  .upload(key, buf, {
    contentType: type.mime,
    cacheControl: "0",
    upsert: false,
  });

  if (error) {
    // Detail error hanya dicatat di terminal server.
    console.error("[Supabase Storage Upload Error]", {
      message: error.message,
      name: error.name,
      statusCode: error.statusCode,
    });

    throw new UploadError(
      "Gagal menyimpan berkas. Silakan coba kembali.",
    );
  }

  return key;
}

/**
 * Membaca file dari bucket privat.
 */
export async function readStored(
  key: string,
): Promise<{ data: Buffer; mime: string } | null> {
  if (!validKey(key)) return null;

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .download(key);

  if (error || !data) {
    if (error) {
      console.error("[Supabase Storage Download Error]", {
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
    }

    return null;
  }

  const buf = Buffer.from(await data.arrayBuffer());
  const detected = detect(buf);

  return detected ? { data: buf, mime: detected.mime } : null;
}

/**
 * Menghapus file dari bucket privat.
 */
export async function deleteStored(key: string | null): Promise<void> {
  if (!key || !validKey(key)) return;

  const { error } = await supabase.storage
    .from(storageBucket)
    .remove([key]);

  if (error) {
    console.error("[Supabase Storage Delete Error]", {
      message: error.message,
      name: error.name,
      statusCode: error.statusCode,
    });

    throw new Error("Gagal menghapus berkas dari penyimpanan.");
  }
}
