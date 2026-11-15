import { PackageSearch } from "lucide-react";
import { FilterBar, parseFilters } from "./filter-bar";
import { ItemCard } from "./item-card";
import { EmptyState, Pagination } from "./ui-bits";
import { query } from "@/lib/db";
import { todayLocal } from "@/lib/utils";
import { listItems } from "@/modules/items/service";
import type { ItemType, SessionUser } from "@/lib/types";

/** Daftar laporan berfilter yang dipakai halaman Barang Hilang / Ditemukan / Cari. */
export async function ItemListPage({
  user, basePath, searchParams, forceType, showType,
}: {
  user: SessionUser; basePath: string; searchParams: Record<string, string | string[] | undefined>; forceType?: ItemType; showType: boolean;
}) {
  const { filters, raw } = parseFilters(searchParams, forceType);
  const [categories, locations, result] = await Promise.all([
    query<{ category_id: number; category_name: string }>("SELECT category_id, category_name FROM categories ORDER BY category_name"),
    query<{ location_id: number; location_name: string }>("SELECT location_id, location_name FROM locations ORDER BY location_name"),
    listItems("public", user, filters),
  ]);
  const hasFilter = Object.entries(raw).some(([k, v]) => v && !(forceType && k === "type"));
  const params = { ...raw, type: showType ? raw.type : undefined } as Record<string, string | undefined>;
  return (
    <>
      <FilterBar basePath={basePath} values={raw} categories={categories} locations={locations} showType={showType}
        statuses={["OPEN", "CLAIM_PENDING", "RETURNED"]} today={todayLocal()} />
      <p className="mb-4 text-sm text-muted" aria-live="polite">{result.total} laporan ditemukan</p>
      {result.items.length === 0 ? (
        <EmptyState icon={PackageSearch}
          title={hasFilter ? "Tidak ada laporan yang cocok" : "Belum ada laporan"}
          description={hasFilter ? "Coba kurangi filter atau gunakan kata kunci yang lebih umum." : "Laporan yang dibuat pengguna akan muncul di sini."} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((i) => <ItemCard key={i.itemId} item={i} />)}</div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath={basePath} params={params} />
    </>
  );
}
