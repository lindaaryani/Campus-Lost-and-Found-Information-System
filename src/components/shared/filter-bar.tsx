import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ITEM_STATUS_LABEL } from "@/lib/labels";
import type { ItemStatus, ItemType } from "@/lib/types";

export interface FilterValues { q?: string; type?: string; categoryId?: string; locationId?: string; status?: string; dateFrom?: string; dateTo?: string }

/** Pencarian + filter (FR-11). GET form => URL dapat dibagikan; halaman server-render. */
export function FilterBar({
  basePath, values, categories, locations, showType, statuses, today,
}: {
  basePath: string; values: FilterValues; categories: { category_id: number; category_name: string }[];
  locations: { location_id: number; location_name: string }[]; showType: boolean; statuses: ItemStatus[]; today: string;
}) {
  const label = "mb-1 block text-xs font-semibold text-muted";
  return (
    <form action={basePath} role="search" className="mb-6 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input name="q" type="search" defaultValue={values.q} maxLength={100} placeholder="Cari nama, warna, atau deskripsi barang…" aria-label="Kata kunci" className="pl-9" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showType && (
          <div>
            <label className={label} htmlFor="f-type">Jenis laporan</label>
            <Select id="f-type" name="type" defaultValue={values.type ?? ""}>
              <option value="">Semua</option><option value="LOST">Barang Hilang</option><option value="FOUND">Barang Ditemukan</option>
            </Select>
          </div>
        )}
        <div>
          <label className={label} htmlFor="f-cat">Kategori</label>
          <Select id="f-cat" name="categoryId" defaultValue={values.categoryId ?? ""}>
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </Select>
        </div>
        <div>
          <label className={label} htmlFor="f-loc">Lokasi</label>
          <Select id="f-loc" name="locationId" defaultValue={values.locationId ?? ""}>
            <option value="">Semua lokasi</option>
            {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
          </Select>
        </div>
        <div>
          <label className={label} htmlFor="f-status">Status</label>
          <Select id="f-status" name="status" defaultValue={values.status ?? ""}>
            <option value="">Semua status</option>
            {statuses.map((s) => <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>)}
          </Select>
        </div>
        <div>
          <label className={label} htmlFor="f-from">Tanggal dari</label>
          <Input id="f-from" name="dateFrom" type="date" max={today} defaultValue={values.dateFrom} />
        </div>
        <div>
          <label className={label} htmlFor="f-to">Tanggal sampai</label>
          <Input id="f-to" name="dateTo" type="date" max={today} defaultValue={values.dateTo} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button asChild variant="ghost" size="sm"><Link href={basePath}>Atur ulang</Link></Button>
        <Button type="submit" size="sm"><Search />Terapkan</Button>
      </div>
    </form>
  );
}

/** Parse searchParams menjadi filter yang aman (nilai tak valid diabaikan). */
export function parseFilters(sp: Record<string, string | string[] | undefined>, forceType?: ItemType) {
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const id = (k: string) => { const v = one(k); return v && /^\d{1,18}$/.test(v) ? Number(v) : undefined; };
  const date = (k: string) => { const v = one(k); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; };
  const type = forceType ?? (one("type") === "LOST" || one("type") === "FOUND" ? (one("type") as ItemType) : undefined);
  const statusRaw = one("status");
  const status = (["OPEN", "CLAIM_PENDING", "RETURNED", "CLOSED", "REJECTED"] as const).find((s) => s === statusRaw);
  const q = one("q")?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Math.min(10_000, Number(one("page")) || 1));
  return {
    filters: { q, type, categoryId: id("categoryId"), locationId: id("locationId"), status, dateFrom: date("dateFrom"), dateTo: date("dateTo"), page },
    raw: { q, type: type ?? undefined, categoryId: one("categoryId"), locationId: one("locationId"), status: status, dateFrom: date("dateFrom"), dateTo: date("dateTo") } as FilterValues,
  };
}
