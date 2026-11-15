import { CalendarDays, ImageOff, Lock, MapPin, Palette, Tag, UserRound } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "./ui-bits";
import { ItemStatusBadge, ItemTypeBadge } from "./badges";
import { HistoryTimeline } from "./history-timeline";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { HistoryEntry, ItemDetail } from "@/modules/items/types";

/**
 * Tampilan detail laporan. `item.privateIdentifier` hanya terisi untuk pemilik/admin (dijamin service),
 * sehingga blok rahasia di sini otomatis tidak muncul bagi pengguna lain.
 */
export function ItemDetailView({
  item, history, adminView = false, aside,
}: { item: ItemDetail; history?: HistoryEntry[]; adminView?: boolean; aside?: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="aspect-[16/9] bg-slate-100">
            {item.hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/photo/${item.itemId}`} alt={`Foto ${item.itemName}`} className="size-full object-contain" />
            ) : (
              <div className="grid size-full place-items-center text-muted"><div className="text-center text-sm"><ImageOff className="mx-auto mb-2 size-8" />Pelapor tidak menyertakan foto</div></div>
            )}
          </div>
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-center gap-2"><ItemTypeBadge type={item.itemType} /><ItemStatusBadge status={item.itemStatus} /></div>
            <div>
              <h1 className="text-2xl font-bold">{item.itemName}</h1>
              <p className="mt-1 text-sm text-muted">Laporan #{item.itemId} · dibuat {formatDateTime(item.createdAt)}</p>
            </div>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2.5"><Tag className="size-4 text-muted" /><span><span className="text-muted">Kategori: </span>{item.categoryName}</span></li>
              <li className="flex items-center gap-2.5"><MapPin className="size-4 text-muted" /><span><span className="text-muted">{item.itemType === "LOST" ? "Terakhir terlihat: " : "Ditemukan di: "}</span>{item.locationName}</span></li>
              <li className="flex items-center gap-2.5"><CalendarDays className="size-4 text-muted" /><span><span className="text-muted">Tanggal: </span>{formatDate(item.incidentDate)}</span></li>
              <li className="flex items-center gap-2.5"><Palette className="size-4 text-muted" /><span><span className="text-muted">Warna: </span>{item.color ?? "-"}</span></li>
              <li className="flex items-center gap-2.5 sm:col-span-2"><UserRound className="size-4 text-muted" />
                <span><span className="text-muted">Dilaporkan oleh: </span>{adminView && item.reporterName ? `${item.reporterName} (${item.reporterLabel})` : item.reporterLabel}</span></li>
            </ul>
            <div>
              <h2 className="mb-1.5 text-sm font-semibold">Deskripsi</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{item.description || "Tidak ada deskripsi."}</p>
            </div>
          </CardBody>
        </Card>

        {item.privateIdentifier && (
          <Card className="border-primary-100">
            <CardHeader className="bg-primary-50/60"><CardTitle className="flex items-center gap-2"><Lock className="size-4 text-primary" />Ciri khusus (rahasia)</CardTitle></CardHeader>
            <CardBody>
              <p className="whitespace-pre-line text-sm">{item.privateIdentifier}</p>
              <p className="mt-3 text-xs text-muted">{adminView ? "Bandingkan dengan keterangan pengaju klaim. Informasi ini tidak tampil untuk pengguna lain." : "Hanya Anda dan admin yang dapat melihat bagian ini."}</p>
            </CardBody>
          </Card>
        )}

        {history && (
          <Card>
            <CardHeader><CardTitle>Riwayat status</CardTitle></CardHeader>
            <CardBody><HistoryTimeline entries={history} /></CardBody>
          </Card>
        )}
      </div>
      {aside && <div className="space-y-4">{aside}</div>}
    </div>
  );
}

export { Alert };
