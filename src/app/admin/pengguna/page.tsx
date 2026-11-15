import type { Metadata } from "next";
import { Search, Users } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { ACCOUNT_STATUSES, USER_TYPES, type AccountStatus, type Role, type UserType } from "@/lib/types";
import { ACCOUNT_STATUS_LABEL, IDENTITY_TYPE_LABEL, USER_TYPE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { listUsers } from "@/modules/admin/users";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/shared/ui-bits";
import { AccountStatusBadge } from "@/components/shared/badges";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Field } from "@/components/shared/forms";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { changeUserStatusAction } from "../actions";

export const metadata: Metadata = { title: "Manajemen Pengguna" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const status = (ACCOUNT_STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as AccountStatus) : undefined;
  const userType = (USER_TYPES as string[]).includes(sp.userType ?? "") ? (sp.userType as UserType) : undefined;
  const role = sp.role === "ADMIN" || sp.role === "USER" ? (sp.role as Role) : undefined;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await listUsers(admin, { q, status, userType, role, page });
  const lbl = "mb-1 block text-xs font-semibold text-muted";

  return (
    <>
      <PageHeader title="Manajemen Pengguna" description="Lihat akun terdaftar dan kelola statusnya. Akun yang dinonaktifkan atau ditangguhkan tidak dapat masuk, dan sesinya langsung dicabut." />
      <form action="/admin/pengguna" role="search" className="mb-6 grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <div><label htmlFor="u-q" className={lbl}>Kata kunci</label><Input id="u-q" name="q" defaultValue={q} maxLength={100} placeholder="Nama, email, atau identitas" /></div>
        <div><label htmlFor="u-role" className={lbl}>Peran</label>
          <Select id="u-role" name="role" defaultValue={role ?? ""}><option value="">Semua</option><option value="USER">Pengguna</option><option value="ADMIN">Admin</option></Select></div>
        <div><label htmlFor="u-type" className={lbl}>Tipe akun</label>
          <Select id="u-type" name="userType" defaultValue={userType ?? ""}><option value="">Semua</option>{USER_TYPES.map((t) => <option key={t} value={t}>{USER_TYPE_LABEL[t]}</option>)}</Select></div>
        <div><label htmlFor="u-st" className={lbl}>Status</label>
          <Select id="u-st" name="status" defaultValue={status ?? ""}><option value="">Semua</option>{ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{ACCOUNT_STATUS_LABEL[s]}</option>)}</Select></div>
        <Button type="submit"><Search />Terapkan</Button>
      </form>
      <p className="mb-4 text-sm text-muted">{r.total} akun</p>
      {r.rows.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada akun" description="Coba ubah filter pencarian." />
      ) : (
        <DataTable caption="Daftar akun pengguna" headers={["Pengguna", "Identitas", "Aktivitas", "Status", "Terdaftar", ""]}>
          {r.rows.map((u) => (
            <tr key={u.userId}>
              <td className="px-4 py-3"><p className="font-semibold">{u.fullName}</p><p className="text-xs text-muted">{u.email}</p></td>
              <td className="px-4 py-3">
                {u.role === "ADMIN" ? <span className="text-muted">Admin · {u.username}</span> : (
                  <><p>{u.identityType ? IDENTITY_TYPE_LABEL[u.identityType] : ""} {u.identityNumber}</p><p className="text-xs text-muted">{u.userType ? USER_TYPE_LABEL[u.userType] : ""}</p></>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted">{u.reportCount} laporan · {u.claimCount} klaim</td>
              <td className="px-4 py-3"><AccountStatusBadge status={u.accountStatus} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(u.createdAt.slice(0, 10))}</td>
              <td className="px-4 py-3 text-right">
                {u.userId === admin.userId ? <span className="text-xs text-muted">Akun Anda</span> : (
                  <ActionDialog trigger="Ubah status" title={`Ubah status ${u.fullName}`}
                    description="Akun yang tidak Aktif tidak dapat masuk dan seluruh sesinya langsung dicabut. Laporan dan klaim lama tetap tersimpan."
                    submitLabel="Simpan status" action={changeUserStatusAction} hidden={{ userId: u.userId }}>
                    <Field name="status" label="Status akun" as="select" required defaultValue={u.accountStatus}>
                      {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{ACCOUNT_STATUS_LABEL[s]}</option>)}
                    </Field>
                    <Field name="note" label="Catatan" as="textarea" rows={2} maxLength={500} hint="Dicatat di log aktivitas." />
                  </ActionDialog>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={r.page} pageCount={r.pageCount} basePath="/admin/pengguna" params={{ q, status, userType, role }} />
    </>
  );
}
