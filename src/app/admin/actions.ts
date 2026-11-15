"use server";
import { revalidatePath } from "next/cache";
import { AuthzError, assertAdmin } from "@/lib/authz";
import { decisionSchema, formToObject, masterSchema, statusChangeSchema, validate } from "@/lib/validation";
import { ClaimError, confirmHandover, decideClaim } from "@/modules/claims/service";
import { adminChangeItemStatus, ItemError } from "@/modules/items/service";
import { AdminError, changeAccountStatus } from "@/modules/admin/users";
import { createMaster, setMasterActive, updateMaster, type MasterKind } from "@/modules/admin/master";
import { ACCOUNT_STATUSES, type ActionState } from "@/lib/types";

type Fail = NonNullable<ActionState>;
const fail = (message: string, extra: Partial<Fail> = {}): Fail => ({ ok: false, message, ...extra });
function toFail(e: unknown, values?: Record<string, string>): Fail {
  if (e instanceof AuthzError || e instanceof ItemError || e instanceof ClaimError || e instanceof AdminError) return fail(e.message, { values });
  throw e;
}
const refresh = () => revalidatePath("/", "layout");

/** FR-19/20, BR-07: keputusan klaim (setujui / tolak / minta bukti tambahan). */
export async function decideClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  try {
    const admin = await assertAdmin();
    const v = validate(decisionSchema, raw);
    if (!v.ok) return v.state;
    await decideClaim(admin, Number(raw.claimId), v.data.decision, v.data.adminNote);
    refresh();
    const msg = { APPROVED: "Klaim disetujui.", REJECTED: "Klaim ditolak dan laporan dibuka kembali.", NEED_INFO: "Permintaan bukti tambahan dikirim ke pengaju." } as const;
    return { ok: true, message: msg[v.data.decision] };
  } catch (e) { return toFail(e, raw); }
}

export async function confirmHandoverAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    await confirmHandover(admin, Number(fd.get("claimId")));
    refresh();
    return { ok: true, message: "Serah terima tercatat. Laporan berstatus Sudah dikembalikan." };
  } catch (e) { return toFail(e); }
}

/** FR-23: moderasi status laporan. */
export async function changeItemStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  try {
    const admin = await assertAdmin();
    const v = validate(statusChangeSchema, raw);
    if (!v.ok) return v.state;
    await adminChangeItemStatus(admin, Number(raw.itemId), v.data.newStatus, v.data.note);
    refresh();
    return { ok: true, message: "Status laporan diperbarui." };
  } catch (e) { return toFail(e, raw); }
}

/** FR-24: status akun pengguna. */
export async function changeUserStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const status = String(fd.get("status"));
    if (!(ACCOUNT_STATUSES as string[]).includes(status)) return fail("Status tidak valid.");
    await changeAccountStatus(admin, Number(fd.get("userId")), status as (typeof ACCOUNT_STATUSES)[number], String(fd.get("note") ?? "").slice(0, 500) || null);
    refresh();
    return { ok: true, message: "Status akun diperbarui. Sesi aktif pengguna dicabut bila akun dinonaktifkan." };
  } catch (e) { return toFail(e); }
}

/** FR-22: data master. */
export async function saveMasterAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const kind = raw.kind as MasterKind;
  if (kind !== "category" && kind !== "location") return fail("Jenis data tidak valid.");
  try {
    const admin = await assertAdmin();
    const label = kind === "category" ? "Nama kategori" : "Nama lokasi";
    const v = validate(masterSchema(label, kind === "category" ? 80 : 120), raw);
    if (!v.ok) return v.state;
    if (v.data.id) await updateMaster(admin, kind, Number(v.data.id), v.data.name, v.data.description);
    else await createMaster(admin, kind, v.data.name, v.data.description);
    refresh();
    return { ok: true, message: v.data.id ? "Perubahan disimpan." : `${kind === "category" ? "Kategori" : "Lokasi"} ditambahkan.` };
  } catch (e) { return toFail(e, raw); }
}

export async function toggleMasterAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const kind = String(fd.get("kind")) as MasterKind;
    if (kind !== "category" && kind !== "location") return fail("Jenis data tidak valid.");
    const active = String(fd.get("active")) === "1";
    await setMasterActive(admin, kind, Number(fd.get("id")), active);
    refresh();
    return { ok: true, message: active ? "Data diaktifkan kembali." : "Data dinonaktifkan. Laporan lama tetap utuh." };
  } catch (e) { return toFail(e); }
}
