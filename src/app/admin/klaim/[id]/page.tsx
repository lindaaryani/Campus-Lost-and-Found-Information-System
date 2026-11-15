import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, FileText, HelpCircle, Lock, PackageCheck, X } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { IDENTITY_TYPE_LABEL, USER_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getClaimForAdmin } from "@/modules/claims/service";
import { Alert, DefinitionList, PageHeader } from "@/components/shared/ui-bits";
import { ClaimStatusBadge, ItemStatusBadge } from "@/components/shared/badges";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Field } from "@/components/shared/forms";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmHandoverAction, decideClaimAction } from "../../actions";

export const metadata: Metadata = { title: "Detail Klaim" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  const c = await getClaimForAdmin(admin, Number(id));
  if (!c) notFound();
  const canDecide = c.claimStatus === "PENDING";
  const canHandover = c.claimStatus === "APPROVED" && c.item.itemStatus === "CLAIM_PENDING";
  return (
    <>
      <Link href="/admin/klaim" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft className="size-4" />Kembali ke daftar klaim
      </Link>
      <PageHeader
        title={`Klaim #${c.claimId}`}
        description={<span className="flex flex-wrap items-center gap-2"><ClaimStatusBadge status={c.claimStatus} /><span>Diajukan {formatDateTime(c.submittedAt)}</span></span>}
      />

      {c.claimStatus === "NEED_INFO" && (
        <Alert tone="info" className="mb-5" title="Menunggu jawaban pengaju">
          Anda sudah meminta bukti tambahan. Keputusan baru dapat dibuat setelah pengaju melengkapi informasi.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Pengaju klaim</CardTitle></CardHeader>
            <CardBody>
              <DefinitionList items={[
                { label: "Nama", value: c.claimant.fullName },
                { label: "Tipe akun", value: c.claimant.userType ? USER_TYPE_LABEL[c.claimant.userType] : "-" },
                { label: c.claimant.identityType ? IDENTITY_TYPE_LABEL[c.claimant.identityType] : "Identitas", value: c.claimant.identityNumber },
                { label: "Email", value: c.claimant.email },
                { label: "Telepon", value: c.claimant.phone },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Keterangan pengaju</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <p className="whitespace-pre-line text-sm leading-relaxed">{c.claimNote}</p>
              {c.hasEvidence ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={`/api/files/evidence/${c.claimId}`} target="_blank" rel="noopener noreferrer"><FileText />Buka bukti kepemilikan</a>
                </Button>
              ) : (
                <p className="text-sm text-muted">Pengaju tidak mengunggah bukti.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Laporan temuan</CardTitle><ItemStatusBadge status={c.item.itemStatus} /></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="font-semibold">{c.item.itemName}</p>
                <Link href={`/admin/laporan/${c.item.itemId}`} className="text-xs font-semibold text-primary hover:underline">Buka laporan #{c.item.itemId}</Link>
              </div>
              <DefinitionList items={[
                { label: "Kategori", value: c.item.categoryName },
                { label: "Lokasi ditemukan", value: c.item.locationName },
                { label: "Warna", value: c.item.color },
                { label: "Tanggal", value: formatDate(c.item.incidentDate) },
                { label: "Dilaporkan oleh", value: c.item.reporterName },
              ]} />
              <p className="whitespace-pre-line text-sm text-muted">{c.item.description}</p>
              {c.item.hasPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/photo/${c.item.itemId}`} alt={`Foto ${c.item.itemName}`} className="max-h-56 rounded-md border border-line object-contain" />
              )}
            </CardBody>
          </Card>
          <Card className="border-primary-100">
            <CardHeader className="bg-primary-50/60">
              <CardTitle className="flex items-center gap-2"><Lock className="size-4 text-primary" />Ciri khusus (rahasia)</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-line text-sm">{c.item.privateIdentifier ?? "Pelapor tidak mengisi ciri khusus."}</p>
              <p className="mt-3 text-xs text-muted">Bandingkan dengan keterangan pengaju. Informasi ini tidak pernah tampil untuk pengguna lain.</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {c.adminNote && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Catatan admin</CardTitle>
            <span className="text-xs text-muted">{c.reviewerName ?? "-"} · {formatDateTime(c.reviewedAt)}</span>
          </CardHeader>
          <CardBody><p className="whitespace-pre-line text-sm">{c.adminNote}</p></CardBody>
        </Card>
      )}

      {(canDecide || canHandover) && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Keputusan</CardTitle></CardHeader>
          <CardBody className="flex flex-wrap gap-3">
            {canDecide && (
              <>
                <ActionDialog trigger={<><Check />Setujui klaim</>} triggerVariant="primary" triggerSize="md" title="Setujui klaim ini?"
                  description="Pengaju akan diberi tahu agar mengikuti prosedur serah terima. Laporan tetap berstatus Menunggu verifikasi klaim sampai serah terima Anda konfirmasi."
                  submitLabel="Setujui klaim" action={decideClaimAction} hidden={{ claimId: c.claimId, decision: "APPROVED" }}>
                  <Field name="adminNote" label="Catatan untuk pengaju" as="textarea" rows={3} maxLength={2000} />
                </ActionDialog>
                <ActionDialog trigger={<><HelpCircle />Minta bukti tambahan</>} triggerVariant="secondary" triggerSize="md" title="Minta bukti tambahan"
                  description="Pengaju akan melihat permintaan ini dan dapat melengkapi informasi atau bukti."
                  submitLabel="Kirim permintaan" action={decideClaimAction} hidden={{ claimId: c.claimId, decision: "NEED_INFO" }}>
                  <Field name="adminNote" label="Apa yang perlu dilengkapi?" as="textarea" rows={4} required minLength={10} maxLength={2000} />
                </ActionDialog>
                <ActionDialog trigger={<><X />Tolak klaim</>} triggerVariant="danger" triggerSize="md" title="Tolak klaim ini?"
                  description="Laporan akan dibuka kembali sehingga dapat diklaim pengguna lain. Alasan Anda akan ditampilkan kepada pengaju."
                  submitLabel="Tolak klaim" submitVariant="danger" action={decideClaimAction} hidden={{ claimId: c.claimId, decision: "REJECTED" }}>
                  <Field name="adminNote" label="Alasan penolakan" as="textarea" rows={4} required minLength={10} maxLength={2000} />
                </ActionDialog>
              </>
            )}
            {canHandover && (
              <ActionDialog trigger={<><PackageCheck />Konfirmasi serah terima</>} triggerVariant="primary" triggerSize="md" title="Konfirmasi serah terima?"
                description="Gunakan setelah barang benar-benar diserahkan kepada pengaju. Status laporan menjadi Sudah dikembalikan dan tidak dapat diubah lagi."
                submitLabel="Ya, barang sudah diserahkan" action={confirmHandoverAction} hidden={{ claimId: c.claimId }} />
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
