import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Eye, FilePlus2, PackagePlus, Pencil } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { ITEM_STATUS_LABEL } from "@/lib/labels";
import { listItems } from "@/modules/items/service";
import { parseFilters } from "@/components/shared/filter-bar";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/shared/ui-bits";
import { ItemStatusBadge, ItemTypeBadge } from "@/components/shared/badges";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { closeItemAction } from "../actions";

export const metadata: Metadata = { title: "Laporan Saya" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { filters, raw } = parseFilters(await searchParams);
  const r = await listItems("mine", user, { type: filters.type, status: filters.status, page: filters.page });
  return (
    <>
      <PageHeader title="Laporan Saya" description="Semua laporan kehilangan dan temuan yang Anda buat."
        actions={<><Button asChild><Link href="/laporan/hilang/baru"><FilePlus2 />Lapor Kehilangan</Link></Button><Button asChild variant="secondary"><Link href="/laporan/ditemukan/baru"><PackagePlus />Lapor Temuan</Link></Button></>} />
      <form action="/laporan-saya" className="mb-5 flex flex-wrap items-end gap-3">
        <div><label htmlFor="t" className="mb-1 block text-xs font-semibold text-muted">Jenis</label>
          <Select id="t" name="type" defaultValue={raw.type ?? ""} className="w-44"><option value="">Semua</option><option value="LOST">Barang Hilang</option><option value="FOUND">Barang Ditemukan</option></Select></div>
        <div><label htmlFor="s" className="mb-1 block text-xs font-semibold text-muted">Status</label>
          <Select id="s" name="status" defaultValue={raw.status ?? ""} className="w-52"><option value="">Semua</option>
            {(["OPEN", "CLAIM_PENDING", "RETURNED", "CLOSED", "REJECTED"] as const).map((s) => <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>)}</Select></div>
        <Button type="submit" variant="secondary">Terapkan</Button>
      </form>
      {r.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Belum ada laporan" description="Laporan yang Anda buat akan muncul di sini beserta statusnya."
          action={<Button asChild><Link href="/laporan/hilang/baru"><FilePlus2 />Buat laporan pertama</Link></Button>} />
      ) : (
        <DataTable caption="Daftar laporan saya" headers={["Barang", "Jenis", "Status", "Tanggal", "Tindakan"]}>
          {r.items.map((i) => (
            <tr key={i.itemId} className="align-middle">
              <td className="px-4 py-3"><Link href={`/barang/${i.itemId}`} className="font-semibold hover:text-primary">{i.itemName}</Link><p className="text-xs text-muted">{i.categoryName} · {i.locationName}</p></td>
              <td className="px-4 py-3"><ItemTypeBadge type={i.itemType} /></td>
              <td className="px-4 py-3"><ItemStatusBadge status={i.itemStatus} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(i.incidentDate)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Button asChild size="sm" variant="ghost"><Link href={`/barang/${i.itemId}`}><Eye />Lihat</Link></Button>
                  {i.itemStatus === "OPEN" && (
                    <>
                      <Button asChild size="sm" variant="ghost"><Link href={`/barang/${i.itemId}/ubah`}><Pencil />Ubah</Link></Button>
                      <ActionDialog trigger="Tutup" triggerVariant="ghost" title="Tutup laporan ini?"
                        description="Laporan yang ditutup tidak tampil di daftar dan tidak ikut dicocokkan."
                        submitLabel="Ya, tutup" submitVariant="danger" action={closeItemAction} hidden={{ itemId: i.itemId }} />
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={r.page} pageCount={r.pageCount} basePath="/laporan-saya" params={{ type: raw.type, status: raw.status }} />
    </>
  );
}
