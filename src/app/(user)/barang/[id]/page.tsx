import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCheck2, PackagePlus, Pencil, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/shared/ui-bits";
import { ItemDetailView } from "@/components/shared/item-detail-view";
import { MatchList } from "@/components/shared/match-list";
import { ClaimStatusBadge } from "@/components/shared/badges";
import { ActionDialog } from "@/components/shared/action-dialog";
import { getItemDetail, getItemHistory } from "@/modules/items/service";
import { listMatchesForUser } from "@/modules/matching/service";
import { getMyClaimOnItem } from "@/modules/claims/service";
import { closeItemAction } from "../../actions";

export const metadata: Metadata = { title: "Detail Laporan" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  const itemId = Number(id);
  const item = await getItemDetail(itemId, user);
  if (!item) notFound();
  const sp = await searchParams;

  const history = item.isOwner ? await getItemHistory(itemId, user) : undefined;
  const matches = item.isOwner && item.itemStatus === "OPEN" ? await listMatchesForUser(user.userId, { itemId }) : [];
  const myClaim = item.itemType === "FOUND" && !item.isOwner ? await getMyClaimOnItem(user.userId, itemId) : null;

  const aside = item.isOwner ? (
    <Card>
      <CardHeader><CardTitle>Kelola laporan</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        {item.itemStatus === "OPEN" ? (
          <>
            <Button asChild variant="secondary" className="w-full"><Link href={`/barang/${itemId}/ubah`}><Pencil />Ubah laporan</Link></Button>
            <ActionDialog trigger="Tutup laporan" triggerVariant="ghost" triggerSize="md" triggerClassName="w-full"
              title="Tutup laporan ini?" description="Gunakan jika barang sudah ketemu atau laporan tidak diperlukan lagi. Laporan yang ditutup tidak tampil di daftar dan tidak ikut dicocokkan."
              submitLabel="Ya, tutup laporan" submitVariant="danger" action={closeItemAction} hidden={{ itemId }} />
          </>
        ) : item.itemStatus === "CLAIM_PENDING" ? (
          <p className="text-sm text-muted">Laporan ini sedang memiliki klaim yang diverifikasi admin, sehingga tidak dapat diubah.</p>
        ) : (
          <p className="text-sm text-muted">Laporan ini sudah berstatus akhir dan tidak dapat diubah.</p>
        )}
      </CardBody>
    </Card>
  ) : item.itemType === "FOUND" ? (
    myClaim ? (
      <Card>
        <CardHeader><CardTitle>Klaim Anda</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <ClaimStatusBadge status={myClaim.claim_status} />
          <Button asChild variant="secondary" className="w-full"><Link href="/klaim"><FileCheck2 />Lihat riwayat klaim</Link></Button>
        </CardBody>
      </Card>
    ) : item.itemStatus === "OPEN" ? (
      <Card className="border-primary-100">
        <CardHeader className="bg-primary-50/60"><CardTitle>Barang ini milik Anda?</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">Ajukan klaim dengan catatan dan bukti kepemilikan. Admin akan memeriksa sebelum barang diserahkan.</p>
          <Button asChild className="w-full"><Link href={`/barang/${itemId}/klaim`}><ShieldCheck />Ajukan klaim</Link></Button>
        </CardBody>
      </Card>
    ) : (
      <Alert tone={item.itemStatus === "RETURNED" ? "success" : "warning"}>
        {item.itemStatus === "CLAIM_PENDING" ? "Barang ini sedang diverifikasi karena sudah ada klaim yang masuk." : "Barang ini sudah dikembalikan kepada pemiliknya."}
      </Alert>
    )
  ) : (
    <Card>
      <CardHeader><CardTitle>Melihat barang ini?</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-muted">Buat laporan temuan agar sistem dapat mencocokkannya dengan laporan kehilangan ini dan pemiliknya diberi tahu.</p>
        <Button asChild variant="secondary" className="w-full"><Link href="/laporan/ditemukan/baru"><PackagePlus />Lapor temuan</Link></Button>
      </CardBody>
    </Card>
  );

  return (
    <>
      <Link href={item.itemType === "LOST" ? "/barang-hilang" : "/barang-ditemukan"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft className="size-4" />Kembali ke daftar
      </Link>
      {sp.baru && (
        <Alert tone="success" title="Laporan berhasil dikirim" className="mb-5">
          {matches.length > 0 ? `Sistem sudah menemukan ${matches.length} laporan yang mirip. Lihat di bagian rekomendasi di bawah.` : "Kami akan memberi tahu Anda lewat notifikasi bila ada laporan lain yang cocok."}
        </Alert>
      )}
      {sp.diubah && <Alert tone="success" title="Laporan diperbarui" className="mb-5">Pencocokan dijalankan ulang dengan data terbaru.</Alert>}
      <ItemDetailView item={item} history={history} aside={aside} />
      {matches.length > 0 && (
        <section className="mt-8" aria-labelledby="rek">
          <h2 id="rek" className="text-lg font-bold">Rekomendasi kecocokan</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Skor hanyalah saran berdasarkan kemiripan data. Skor tinggi bukan bukti kepemilikan; verifikasi tetap dilakukan admin.</p>
          <MatchList matches={matches} showOwn={false} />
        </section>
      )}
    </>
  );
}
