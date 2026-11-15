import { z } from "zod";
import type { ActionState } from "./types";
import { IDENTITY_OPTIONS } from "./labels";
import { todayLocal } from "./utils";

/** Ubah FormData menjadi objek string (berkas diabaikan). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}

/** Jalankan skema; bila gagal kembalikan ActionState dengan galat per-kolom + nilai isian (agar form tidak kosong). */
export function validate<T>(
  schema: z.ZodType<T>,
  raw: Record<string, string>,
): { ok: true; data: T } | { ok: false; state: NonNullable<ActionState> } {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const flat = z.flattenError(parsed.error);
  const fieldErrors: Record<string, string[]> = { ...flat.fieldErrors } as Record<string, string[]>;
  const values = { ...raw };
  delete values.password; delete values.confirmPassword;
  return {
    ok: false,
    state: {
      ok: false,
      message: flat.formErrors[0] ?? "Periksa kembali isian yang ditandai.",
      fieldErrors,
      values,
    },
  };
}

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(min, min <= 1 ? `${label} wajib diisi.` : `${label} minimal ${min} karakter.`)
    .max(max, `${label} maksimal ${max} karakter.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter.`)
    .optional()
    .transform((v) => (v ? v : null));

const idField = (label: string) =>
  z
    .string({ error: `${label} wajib dipilih.` })
    .regex(/^\d{1,18}$/, `${label} wajib dipilih.`)
    .transform((v) => Number(v));

const userTypeEnum = z.enum(["STUDENT", "LECTURER", "STAFF"], { error: "Tipe akun wajib dipilih." });
const identityTypeEnum = z.enum(["NIM", "NIDN", "NIP", "EMPLOYEE_ID"], { error: "Jenis identitas tidak valid." });

const identityNumber = z
  .string({ error: "Nomor identitas wajib diisi." })
  .trim()
  .min(4, "Nomor identitas minimal 4 karakter.")
  .max(40, "Nomor identitas maksimal 40 karakter.")
  .regex(/^[A-Za-z0-9./-]+$/, "Nomor identitas hanya boleh berisi huruf, angka, titik, garis miring, atau tanda hubung.");

/** Cek kecocokan user_type <-> identity_type (BR-04) dan format NIM. */
function checkIdentity(
  v: { userType: keyof typeof IDENTITY_OPTIONS; identityType: string; identityNumber: string },
  ctx: z.RefinementCtx,
) {
  if (!IDENTITY_OPTIONS[v.userType].includes(v.identityType as never)) {
    ctx.addIssue({ code: "custom", path: ["identityType"], message: "Jenis identitas tidak sesuai dengan tipe akun." });
  }
  if (v.identityType === "NIM" && !/^\d{5,20}$/.test(v.identityNumber)) {
    ctx.addIssue({ code: "custom", path: ["identityNumber"], message: "NIM hanya boleh berisi angka (5-20 digit)." });
  }
}

export const loginSchema = z
  .object({
    accountType: z.enum(["USER", "ADMIN"], { error: "Jenis akun tidak valid." }),
    userType: userTypeEnum.optional(),
    identityType: identityTypeEnum.optional(),
    identityNumber: z.string().trim().max(40).optional(),
    username: z.string().trim().max(60).optional(),
    password: z.string({ error: "Kata sandi wajib diisi." }).min(1, "Kata sandi wajib diisi.").max(200),
  })
  .superRefine((v, ctx) => {
    if (v.accountType === "ADMIN") {
      if (!v.username) ctx.addIssue({ code: "custom", path: ["username"], message: "Username admin wajib diisi." });
    } else {
      if (!v.userType) ctx.addIssue({ code: "custom", path: ["userType"], message: "Tipe akun wajib dipilih." });
      if (!v.identityType) ctx.addIssue({ code: "custom", path: ["identityType"], message: "Jenis identitas wajib dipilih." });
      if (!v.identityNumber) ctx.addIssue({ code: "custom", path: ["identityNumber"], message: "Nomor identitas wajib diisi." });
      if (v.userType && v.identityType && v.identityNumber) {
        checkIdentity({ userType: v.userType, identityType: v.identityType, identityNumber: v.identityNumber }, ctx);
      }
    }
  });

const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[0-9+\-\s]{8,20}$/.test(v), "Nomor telepon tidak valid (8-20 digit).");

const email = z
  .string({ error: "Email wajib diisi." })
  .trim()
  .toLowerCase()
  .max(150, "Email maksimal 150 karakter.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Format email tidak valid.");

export const registerSchema = z
  .object({
    userType: userTypeEnum,
    identityType: identityTypeEnum,
    identityNumber,
    fullName: trimmed(3, 120, "Nama lengkap"),
    email,
    phoneNumber: phone,
    password: z
      .string({ error: "Kata sandi wajib diisi." })
      .min(8, "Kata sandi minimal 8 karakter.")
      .max(200, "Kata sandi maksimal 200 karakter.")
      .regex(/[A-Za-z]/, "Kata sandi harus memuat huruf.")
      .regex(/\d/, "Kata sandi harus memuat angka."),
    confirmPassword: z.string({ error: "Konfirmasi kata sandi wajib diisi." }),
  })
  .superRefine((v, ctx) => {
    checkIdentity(v, ctx);
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak sama." });
    }
  });

export const profileSchema = z.object({
  fullName: trimmed(3, 120, "Nama lengkap"),
  email,
  phoneNumber: phone,
});

function isRealDate(s: string) {
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const itemSchema = z
  .object({
    itemType: z.enum(["LOST", "FOUND"]),
    itemName: trimmed(3, 150, "Nama barang"),
    categoryId: idField("Kategori"),
    locationId: idField("Lokasi"),
    color: trimmed(2, 60, "Warna"),
    description: trimmed(10, 2000, "Deskripsi"),
    incidentDate: z.string({ error: "Tanggal wajib diisi." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid."),
    privateIdentifier: optionalText(1000, "Ciri khusus"),
  })
  .superRefine((v, ctx) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v.incidentDate)) {
      if (!isRealDate(v.incidentDate)) ctx.addIssue({ code: "custom", path: ["incidentDate"], message: "Tanggal tidak valid." });
      else if (v.incidentDate > todayLocal())
        ctx.addIssue({ code: "custom", path: ["incidentDate"], message: "Tanggal tidak boleh melebihi hari ini." });
      else if (v.incidentDate < "2020-01-01")
        ctx.addIssue({ code: "custom", path: ["incidentDate"], message: "Tanggal terlalu lampau." });
    }
    // Asumsi: laporan FOUND wajib memuat ciri khusus untuk verifikasi klaim (diagram aktivitas Gambar 10).
    if (v.itemType === "FOUND" && (!v.privateIdentifier || v.privateIdentifier.length < 5)) {
      ctx.addIssue({
        code: "custom",
        path: ["privateIdentifier"],
        message: "Ciri khusus wajib diisi (min. 5 karakter) agar klaim dapat diverifikasi.",
      });
    }
  });

export const claimSchema = z.object({
  claimNote: trimmed(20, 2000, "Catatan klaim"),
});

export const claimInfoSchema = z.object({
  claimNote: trimmed(10, 2000, "Informasi tambahan"),
});

export const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "NEED_INFO"], { error: "Pilih keputusan." }),
    adminNote: z.string().trim().max(2000, "Catatan maksimal 2000 karakter.").optional().transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if ((v.decision === "REJECTED" || v.decision === "NEED_INFO") && (!v.adminNote || v.adminNote.length < 10)) {
      ctx.addIssue({
        code: "custom",
        path: ["adminNote"],
        message: "Catatan wajib diisi (min. 10 karakter) agar pengguna memahami keputusan ini.",
      });
    }
  });

export const statusChangeSchema = z.object({
  newStatus: z.enum(["OPEN", "CLOSED", "REJECTED"], { error: "Status tidak valid." }),
  note: trimmed(5, 1000, "Alasan perubahan"),
});

export const masterSchema = (label: string, max: number) =>
  z.object({
    id: z.string().regex(/^\d+$/).optional(),
    name: trimmed(2, max, label),
    description: optionalText(255, "Deskripsi"),
  });
