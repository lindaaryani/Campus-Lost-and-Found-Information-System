import { ITEM_STATUS_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import type { ItemStatus } from "@/lib/types";
import type { HistoryEntry } from "@/modules/items/types";

const label = (s: string | null) => (s ? ITEM_STATUS_LABEL[s as ItemStatus] ?? s : "—");

/** Riwayat perubahan status (FR-25, FR-31). Urutan = kronologis. */
export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted">Belum ada riwayat.</p>;
  return (
    <ol className="relative space-y-5 border-l-2 border-line pl-5">
      {entries.map((h) => (
        <li key={h.historyId} className="relative">
          <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-surface bg-primary ring-1 ring-primary-100" aria-hidden />
          <p className="text-sm font-semibold">
            {h.oldStatus ? <>{label(h.oldStatus)} <span className="font-normal text-muted">→</span> {label(h.newStatus)}</> : label(h.newStatus)}
          </p>
          {h.note && <p className="mt-0.5 text-sm text-muted">{h.note}</p>}
          <p className="mt-0.5 text-xs text-muted">{formatDateTime(h.changedAt)} · {h.actor}</p>
        </li>
      ))}
    </ol>
  );
}
