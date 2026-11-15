import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { getItemDetail, getItemHistory } from "@/modules/items/service";
import { listClaimsForItem } from "@/modules/claims/service";
import { ItemDetailView } from "@/components/shared/item-detail-view";
import { ClaimStatusBadge } from "@/components/shared/badges";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Field } from "@/components/shared/forms";
import { Alert } from "@/components/shared/ui-bits";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { changeItemStatusAction } from "../../actions";

export const metadata: Metadata = { title: "Kelola Laporan" };

const LABELS = { OPEN: "Terbuka", CLOSED: "Ditutup", REJECTED: "Ditolak admin" } as const;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  const item = await getItemDetail(Number(id), admin);
  if (!item) notFound();
  const [history, claims] = await Promise.all([getItemHistory(item.itemId, admin), listClaimsForItem(admin, item.itemId)]);
  const options = (["OPEN", "CLOSED", "REJECTED"] as const).filter((s) => s !== item.itemStatus);
  const locked = item.itemStatus === "CLAIM_PENDING" || item.itemStatus === "RETURNED";

  const aside = (
    <>
      <Card>
        <CardHeader><CardTitle>Moderasi status</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {locked ? (
            <Alert tone="info">
              {item.itemStatus === "CLAIM_PENDING" ? "Laporan memiliki klaim aktif. Selesaikan lewat Verifikasi Klaim." : "Laporan sudah dikembalikan dan berstatus akhir."}
            </Alert>
          ) : (
            <ActionDialog trigger="Ubah status" triggerVariant="primary" triggerSize="md" triggerClassName="w-full" title="Ubah status laporan"
              description="Pelapor akan menerima notifikasi berisi alasan Anda. Perubahan dicatat di riwayat dan log aktivitas."
              submitLabel="Simpan status" action={changeItemStatusAction} hidden={{ itemId: item.itemId }}>
              <Field name="newStatus" label="Status baru" as="select" required defaultValue={options[0]}>
                {options.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
              </Field>
              <Field name="note" label="Alasan perubahan" as="textarea" rows={3} required minLength={5} maxLength={1000}
                hint="Contoh: laporan melanggar ketentuan, atau laporan duplikat." />
            </ActionDialog>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Klaim pada laporan ini</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {claims.length === 0 ? (
            <p className="text-sm text-muted">Belum ada klaim.</p>
          ) : (
            claims.map((c) => (
              <Link key={c.claim_id} href={`/admin/klaim/${c.claim_id}`} className="flex items-center justify-between gap-2 rounded-md border border-line p-3 hover:border-primary-100">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{c.full_name}</p><p className="text-xs text-muted">{formatDateTime(c.submitted_at)}</p></div>
                <ClaimStatusBadge status={c.claim_status} />
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );

  return (
    <>
      <Link href="/admin/laporan" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft className="size-4" />Kembali ke daftar laporan
      </Link>
      <ItemDetailView item={item} history={history} adminView aside={aside} />
    </>
  );
}
