"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertUser, AuthzError } from "@/lib/authz";
import { deleteStored, saveUpload, UploadError } from "@/lib/uploads";
import {
  claimInfoSchema, claimSchema, formToObject, itemSchema, profileSchema, validate,
} from "@/lib/validation";
import { closeOwnItem, createItem, ItemError, updateItem } from "@/modules/items/service";
import { cancelClaim, ClaimError, respondToNeedInfo, submitClaim } from "@/modules/claims/service";
import { dismissMatch } from "@/modules/matching/service";
import { markAllRead, markRead } from "@/modules/notifications/service";
import { RegisterError, updateProfile } from "@/modules/auth/service";
import type { ActionState } from "@/lib/types";

type Fail = NonNullable<ActionState>;
const fail = (message: string, extra: Partial<Fail> = {}): Fail => ({ ok: false, message, ...extra });
const file = (fd: FormData, name: string) => {
  const f = fd.get(name);
  return f instanceof File && f.size > 0 ? f : null;
};

/** Ubah galat domain yang dikenal menjadi pesan untuk pengguna; galat tak dikenal dilempar ulang. */
function toFail(e: unknown, values?: Record<string, string>): Fail {
  if (e instanceof AuthzError || e instanceof ItemError || e instanceof ClaimError || e instanceof UploadError)
    return fail(e.message, { values });
  if (e instanceof RegisterError) return fail(e.message, { values, fieldErrors: e.field ? { [e.field]: [e.message] } : undefined });
  throw e;
}

// ------------------------------------------------------------------ laporan (FR-08/09/10)

export async function createItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  let photoKey: string | null = null;
  try {
    const user = await assertUser();
    const v = validate(itemSchema, raw);
    if (!v.ok) return v.state;
    try { photoKey = await saveUpload(file(fd, "photo"), "photo"); }
    catch (e) { if (e instanceof UploadError) return fail("Periksa foto yang diunggah.", { fieldErrors: { photo: [e.message] }, values: raw }); throw e; }
    const id = await createItem(user, v.data, photoKey);
    revalidatePath("/", "layout");
    redirect(`/barang/${id}?baru=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    await deleteStored(photoKey);
    return toFail(e, raw);
  }
}

export async function updateItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const itemId = Number(raw.itemId);
  let photoKey: string | null = null;
  try {
    const user = await assertUser();
    if (!Number.isInteger(itemId) || itemId <= 0) return fail("Laporan tidak valid.");
    // itemType tidak dapat diubah: ambil dari data laporan untuk validasi (bukan dari klien)
    const v = validate(itemSchema, { ...raw, itemType: raw.itemType === "FOUND" ? "FOUND" : "LOST" });
    if (!v.ok) return v.state;
    try { photoKey = await saveUpload(file(fd, "photo"), "photo"); }
    catch (e) { if (e instanceof UploadError) return fail("Periksa foto yang diunggah.", { fieldErrors: { photo: [e.message] }, values: raw }); throw e; }
    const { itemType: _t, ...input } = v.data; void _t;
    const { oldPhotoKey } = await updateItem(user, itemId, input, { newPhotoKey: photoKey, removePhoto: raw.removePhoto === "on" });
    await deleteStored(oldPhotoKey);
    revalidatePath("/", "layout");
    redirect(`/barang/${itemId}?diubah=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    await deleteStored(photoKey);
    return toFail(e, raw);
  }
}

export async function closeItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertUser();
    await closeOwnItem(user, Number(fd.get("itemId")));
    revalidatePath("/", "layout");
    return { ok: true, message: "Laporan ditutup." };
  } catch (e) { return toFail(e); }
}

// ------------------------------------------------------------------ klaim (FR-17/18/28)

export async function submitClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const itemId = Number(raw.itemId);
  let key: string | null = null;
  try {
    const user = await assertUser();
    const v = validate(claimSchema, raw);
    if (!v.ok) return v.state;
    try { key = await saveUpload(file(fd, "evidence"), "evidence"); }
    catch (e) { if (e instanceof UploadError) return fail("Periksa berkas bukti.", { fieldErrors: { evidence: [e.message] }, values: raw }); throw e; }
    await submitClaim(user, itemId, v.data.claimNote, key);
    revalidatePath("/", "layout");
    redirect("/klaim?diajukan=1");
  } catch (e) {
    if (isRedirect(e)) throw e;
    await deleteStored(key);
    return toFail(e, raw);
  }
}

export async function cancelClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertUser();
    await cancelClaim(user, Number(fd.get("claimId")));
    revalidatePath("/", "layout");
    return { ok: true, message: "Klaim dibatalkan. Laporan kembali terbuka untuk diklaim." };
  } catch (e) { return toFail(e); }
}

export async function respondInfoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  let key: string | null = null;
  try {
    const user = await assertUser();
    const v = validate(claimInfoSchema, raw);
    if (!v.ok) return v.state;
    try { key = await saveUpload(file(fd, "evidence"), "evidence"); }
    catch (e) { if (e instanceof UploadError) return fail("Periksa berkas bukti.", { fieldErrors: { evidence: [e.message] }, values: raw }); throw e; }
    const { oldEvidenceKey } = await respondToNeedInfo(user, Number(raw.claimId), v.data.claimNote, key);
    await deleteStored(oldEvidenceKey);
    revalidatePath("/", "layout");
    return { ok: true, message: "Informasi tambahan terkirim. Klaim Anda kembali diperiksa admin." };
  } catch (e) {
    await deleteStored(key);
    return toFail(e, raw);
  }
}

// ------------------------------------------------------------------ rekomendasi, notifikasi, profil

export async function dismissMatchAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertUser();
    const ok = await dismissMatch(user.userId, Number(fd.get("matchId")));
    revalidatePath("/", "layout");
    return ok ? { ok: true, message: "Rekomendasi diabaikan." } : fail("Rekomendasi tidak ditemukan atau sudah diproses.");
  } catch (e) { return toFail(e); }
}

export async function markNotificationReadAction(fd: FormData): Promise<void> {
  const user = await assertUser();
  await markRead(user.userId, Number(fd.get("notificationId")));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await assertUser();
  await markAllRead(user.userId);
  revalidatePath("/", "layout");
}

export async function updateProfileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  try {
    const user = await assertUser();
    const v = validate(profileSchema, raw);
    if (!v.ok) return v.state;
    await updateProfile(user.userId, v.data);
    revalidatePath("/", "layout");
    return { ok: true, message: "Profil diperbarui." };
  } catch (e) { return toFail(e, raw); }
}

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
