import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { query } from "@/lib/db";
import { formatDate, todayLocal } from "@/lib/utils";
import { listItems } from "@/modules/items/service";
import { FilterBar, parseFilters } from "@/components/shared/filter-bar";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/shared/ui-bits";
import { ItemStatusBadge, ItemTypeBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Manajemen Laporan" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  const { filters, raw } = parseFilters(await searchParams);
  const [categories, locations, r] = await Promise.all([
    query<{ category_id: number; category_name: string }>("SELECT category_id, category_name FROM categories ORDER BY category_name"),
    query<{ location_id: number; location_name: string }>("SELECT location_id, location_name FROM locations ORDER BY location_name"),
    listItems("admin", admin, filters),
  ]);
  return (
    <>
      <PageHeader title="Manajemen Laporan" description="Semua laporan hilang dan temuan. Buka laporan untuk memoderasi status dan melihat riwayatnya." />
      <FilterBar basePath="/admin/laporan" values={raw} categories={categories} locations={locations} showType
        statuses={["OPEN", "CLAIM_PENDING", "RETURNED", "CLOSED", "REJECTED"]} today={todayLocal()} />
      <p className="mb-4 text-sm text-muted">{r.total} laporan</p>
      {r.items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Tidak ada laporan" description="Coba ubah filter pencarian." />
      ) : (
        <DataTable caption="Daftar semua laporan" headers={["Barang", "Jenis", "Status", "Pelapor", "Tanggal", ""]}>
          {r.items.map((i) => (
            <tr key={i.itemId}>
              <td className="px-4 py-3"><p className="font-semibold">{i.itemName}</p><p className="text-xs text-muted">#{i.itemId} · {i.categoryName} · {i.locationName}</p></td>
              <td className="px-4 py-3"><ItemTypeBadge type={i.itemType} /></td>
              <td className="px-4 py-3"><ItemStatusBadge status={i.itemStatus} /></td>
              <td className="px-4 py-3">{i.reporterName}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(i.incidentDate)}</td>
              <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="secondary"><Link href={`/admin/laporan/${i.itemId}`}>Kelola</Link></Button></td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={r.page} pageCount={r.pageCount} basePath="/admin/laporan" params={raw as Record<string, string | undefined>} />
    </>
  );
}
