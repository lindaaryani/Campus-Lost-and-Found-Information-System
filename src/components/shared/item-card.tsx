import Link from "next/link";
import { CalendarDays, ImageOff, MapPin, Palette } from "lucide-react";
import { ItemStatusBadge, ItemTypeBadge } from "./badges";
import { formatDate, cn } from "@/lib/utils";
import type { ItemCard as ItemCardData } from "@/modules/items/types";

/** Kartu laporan. Hanya menampilkan field publik; bergaris-kiri merah (LOST) atau biru (FOUND). */
export function ItemCard({ item, href }: { item: ItemCardData; href?: string }) {
  return (
    <Link
      href={href ?? `/barang/${item.itemId}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-line border-l-4 bg-surface shadow-card transition-colors hover:border-primary-100",
        item.itemType === "LOST" ? "border-l-accent-red" : "border-l-primary",
      )}
    >
      <div className="relative aspect-[16/10] bg-slate-100">
        {item.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/photo/${item.itemId}`} alt={`Foto ${item.itemName}`} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted"><div className="text-center text-xs"><ImageOff className="mx-auto mb-1 size-6" />Tanpa foto</div></div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2"><ItemTypeBadge type={item.itemType} /><ItemStatusBadge status={item.itemStatus} /></div>
        <div>
          <h3 className="line-clamp-2 font-semibold group-hover:text-primary">{item.itemName}</h3>
          <p className="mt-0.5 text-xs text-muted">{item.categoryName}</p>
        </div>
        {item.descriptionSnippet && <p className="line-clamp-2 text-sm text-muted">{item.descriptionSnippet}</p>}
        <ul className="mt-auto space-y-1 text-xs text-muted">
          <li className="flex items-center gap-1.5"><MapPin className="size-3.5" />{item.locationName}</li>
          <li className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDate(item.incidentDate)}</li>
          {item.color && <li className="flex items-center gap-1.5"><Palette className="size-3.5" />{item.color}</li>}
        </ul>
      </div>
    </Link>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="skeleton aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-4"><div className="skeleton h-5 w-1/2" /><div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-2/3" /></div>
    </div>
  );
}
