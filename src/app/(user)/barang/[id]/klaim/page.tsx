import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { config } from "@/lib/config";
import { getItemDetail } from "@/modules/items/service";
import { Alert, PageHeader } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ItemStatusBadge, ItemTypeBadge } from "@/components/shared/badges";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Ajukan Klaim" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  const item = await getItemDetail(Number(id), user);
  if (!item) notFound();

  let blocked: string | null = null;
  if (item.itemType !== "FOUND") blocked = "Klaim hanya dapat diajukan untuk laporan barang ditemukan.";
  else if (item.isOwner) blocked = "Anda tidak dapat mengklaim laporan yang Anda buat sendiri.";
  else if (item.itemStatus !== "OPEN") blocked = "Barang ini sedang tidak dapat diklaim karena statusnya bukan Terbuka.";

  return (
    <>
      <PageHeader title="Ajukan Klaim" description="Admin akan memeriksa klaim Anda. Pastikan keterangan dan bukti benar, klaim palsu dapat berakibat pada status akun Anda." />
      <div className="grid max-w-4xl gap-6 md:grid-cols-[1fr_280px]">
        <Card className="order-2 md:order-1"><CardBody>
          {blocked ? (
            <div className="space-y-4"><Alert tone="warning">{blocked}</Alert><Button asChild variant="secondary"><Link href={`/barang/${item.itemId}`}>Kembali ke laporan</Link></Button></div>
          ) : (
            <ClaimForm itemId={item.itemId} maxEvidenceMB={config.maxEvidenceBytes / 1048576} />
          )}
        </CardBody></Card>
        <Card className="order-1 h-fit md:order-2"><CardBody className="space-y-3">
          <p className="text-xs font-semibold text-muted">Barang yang diklaim</p>
          <div className="flex flex-wrap gap-2"><ItemTypeBadge type={item.itemType} /><ItemStatusBadge status={item.itemStatus} /></div>
          <p className="font-semibold">{item.itemName}</p>
          <p className="text-sm text-muted">{item.categoryName} · {item.locationName}</p>
          <Link href={`/barang/${item.itemId}`} className="text-sm font-semibold text-primary hover:underline">Lihat laporan</Link>
        </CardBody></Card>
      </div>
    </>
  );
}
