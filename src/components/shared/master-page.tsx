import { Plus, Power, PowerOff, Pencil, Tags } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { listMaster, type MasterKind } from "@/modules/admin/master";
import { DataTable, EmptyState, PageHeader } from "./ui-bits";
import { ActionDialog } from "./action-dialog";
import { Field } from "./forms";
import { Badge } from "./master-badge";
import { saveMasterAction, toggleMasterAction } from "@/app/admin/actions";

const COPY = {
  category: { title: "Kategori Barang", noun: "kategori", desc: "Jenis barang yang dapat dipilih pelapor. Kategori yang dinonaktifkan tidak muncul di formulir baru, tetapi laporan lama tetap utuh.", max: 80 },
  location: { title: "Lokasi Kampus", noun: "lokasi", desc: "Tempat barang hilang atau ditemukan. Lokasi yang dinonaktifkan tidak muncul di formulir baru, tetapi laporan lama tetap utuh.", max: 120 },
} as const;

/** Halaman CRUD data master (FR-22). Tidak ada hapus; hanya nonaktifkan agar integritas laporan terjaga. */
export async function MasterPage({ kind }: { kind: MasterKind }) {
  await requireAdmin();
  const rows = await listMaster(kind);
  const c = COPY[kind];
  return (
    <>
      <PageHeader title={c.title} description={c.desc}
        actions={
          <ActionDialog trigger={<><Plus />Tambah {c.noun}</>} triggerVariant="primary" triggerSize="md" title={`Tambah ${c.noun}`} submitLabel="Simpan"
            action={saveMasterAction} hidden={{ kind }}>
            <Field name="name" label={`Nama ${c.noun}`} required minLength={2} maxLength={c.max} />
            <Field name="description" label="Deskripsi" as="textarea" rows={2} maxLength={255} />
          </ActionDialog>
        } />
      {rows.length === 0 ? <EmptyState icon={Tags} title={`Belum ada ${c.noun}`} description="Tambahkan data pertama agar pengguna dapat membuat laporan." /> : (
        <DataTable caption={c.title} headers={["Nama", "Deskripsi", "Dipakai", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className={r.isActive ? "" : "bg-slate-50/70 text-muted"}>
              <td className="px-4 py-3 font-semibold">{r.name}</td>
              <td className="px-4 py-3 text-muted">{r.description ?? "-"}</td>
              <td className="px-4 py-3 tabular-nums">{r.usage} laporan</td>
              <td className="px-4 py-3"><Badge active={r.isActive} /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  <ActionDialog trigger={<><Pencil />Ubah</>} triggerVariant="ghost" title={`Ubah ${c.noun}`} submitLabel="Simpan perubahan" action={saveMasterAction} hidden={{ kind, id: r.id }}>
                    <Field name="name" label={`Nama ${c.noun}`} required minLength={2} maxLength={c.max} defaultValue={r.name} />
                    <Field name="description" label="Deskripsi" as="textarea" rows={2} maxLength={255} defaultValue={r.description} />
                  </ActionDialog>
                  <ActionDialog trigger={r.isActive ? <><PowerOff />Nonaktifkan</> : <><Power />Aktifkan</>} triggerVariant="ghost"
                    title={r.isActive ? `Nonaktifkan "${r.name}"?` : `Aktifkan kembali "${r.name}"?`}
                    description={r.isActive ? `Tidak akan muncul di formulir laporan baru. ${r.usage} laporan lama yang memakainya tidak berubah.` : "Akan kembali muncul di formulir laporan baru."}
                    submitLabel={r.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"} submitVariant={r.isActive ? "danger" : "primary"}
                    action={toggleMasterAction} hidden={{ kind, id: r.id, active: r.isActive ? 0 : 1 }} />
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
