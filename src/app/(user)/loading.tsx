import { Skeleton } from "@/components/ui/skeleton";
import { ItemCardSkeleton } from "@/components/shared/item-card";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman">
      <Skeleton className="mb-2 h-8 w-56" /><Skeleton className="mb-8 h-4 w-96 max-w-full" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <ItemCardSkeleton key={i} />)}</div>
    </div>
  );
}
