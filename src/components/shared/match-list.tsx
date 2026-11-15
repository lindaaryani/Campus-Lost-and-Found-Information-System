import Link from "next/link";
import { CalendarDays, ImageOff, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemStatusBadge, ItemTypeBadge, MatchStatusBadge, ScoreMeter } from "./badges";
import { DismissMatchButton } from "./dismiss-match";
import { formatDate } from "@/lib/utils";
import type { MatchView } from "@/modules/matching/service";

/** Daftar rekomendasi kecocokan (FR-16). Hanya data publik laporan lawan; skor ≠ bukti kepemilikan. */
export function MatchList({ matches, showOwn = true }: { matches: MatchView[]; showOwn?: boolean }) {
  return (
    <ul className="space-y-4">
      {matches.map((m) => (
        <li key={m.matchId}>
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-md bg-slate-100 sm:h-auto sm:w-36">
                {m.other.hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/photo/${m.other.itemId}`} alt={`Foto ${m.other.itemName}`} loading="lazy" className="size-full object-cover" />
                ) : <div className="grid size-full place-items-center text-xs text-muted"><ImageOff className="size-5" /></div>}
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ItemTypeBadge type={m.other.itemType} /><ItemStatusBadge status={m.other.itemStatus} /><MatchStatusBadge status={m.status} />
                </div>
                <div>
                  <h3 className="font-semibold">{m.other.itemName}</h3>
                  <p className="text-xs text-muted">{m.other.categoryName}{m.other.color ? ` · ${m.other.color}` : ""}</p>
                </div>
                {m.other.description && <p className="line-clamp-2 text-sm text-muted">{m.other.description}</p>}
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{m.other.locationName}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDate(m.other.incidentDate)}</span>
                </p>
                {showOwn && (
                  <p className="text-xs text-muted">Cocok dengan laporan Anda: <Link className="font-semibold text-primary hover:underline" href={`/barang/${m.own.itemId}`}>{m.own.itemName}</Link></p>
                )}
              </div>
              <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-44 sm:flex-col sm:items-end sm:justify-start">
                <div className="sm:text-right"><p className="mb-1 text-xs font-semibold text-muted">Kemiripan</p><ScoreMeter score={m.score} /></div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button asChild size="sm"><Link href={`/barang/${m.other.itemId}`}><Sparkles />Lihat laporan</Link></Button>
                  {m.status === "SUGGESTED" && <DismissMatchButton matchId={m.matchId} />}
                </div>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
