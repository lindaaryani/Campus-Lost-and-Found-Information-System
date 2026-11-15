import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2, FileText, Search } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { formatDateTime } from "@/lib/utils";
import { listClaimsForUser } from "@/modules/claims/service";
import { Alert, EmptyState, PageHeader } from "@/components/shared/ui-bits";
import { ClaimStatusBadge, ItemStatusBadge } from "@/components/shared/badges";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Field, FileField } from "@/components/shared/forms";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { cancelClaimAction, respondInfoAction } from "../actions";

export const metadata: Metadata = { title: "Klaim Saya" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const claims = await listClaimsForUser(user.userId);
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Klaim Saya" description="Riwayat klaim kepemilikan beserta hasil pemeriksaan admin." />
      {sp.diajukan && <Alert tone="success" title="Klaim berhasil diajukan" className="mb-5">Admin akan memeriksa klaim Anda. Anda akan mendapat notifikasi saat ada keputusan.</Alert>}
      {claims.some((c) => c.claimStatus === "NEED_INFO") && (
        <Alert tone="warning" title="Admin meminta bukti tambahan" className="mb-5">Buka klaim bertanda &quot;Perlu bukti tambahan&quot; di bawah dan lengkapi informasinya agar pemeriksaan dapat dilanjutkan.</Alert>
      )}
      {claims.length === 0 ? (
        <EmptyState icon={FileCheck2} title="Belum ada klaim" description="Temukan barang Anda di daftar Barang Ditemukan, lalu ajukan klaim dengan bukti kepemilikan."
          action={<Button asChild><Link href="/barang-ditemukan"><Search />Cari barang ditemukan</Link></Button>} />
      ) : (
        <ul className="space-y-4">
          {claims.map((c) => (
            <li key={c.claimId}>
              <Card><CardBody className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/barang/${c.itemId}`} className="text-base font-semibold hover:text-primary">{c.itemName}</Link>
                    <p className="mt-0.5 text-xs text-muted">Klaim #{c.claimId} · diajukan {formatDateTime(c.submittedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><ClaimStatusBadge status={c.claimStatus} /><ItemStatusBadge status={c.itemStatus} /></div>
                </div>
                <div className="rounded-md bg-slate-50 p-3.5"><p className="mb-1 text-xs font-semibold text-muted">Catatan Anda</p><p className="whitespace-pre-line text-sm">{c.claimNote}</p></div>
                {c.adminNote && (
                  <div className="rounded-md border border-primary-100 bg-primary-50/60 p-3.5">
                    <p className="mb-1 text-xs font-semibold text-navy">Catatan admin{c.reviewedAt ? ` · ${formatDateTime(c.reviewedAt)}` : ""}</p>
                    <p className="whitespace-pre-line text-sm">{c.adminNote}</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {c.hasEvidence && <Button asChild variant="ghost" size="sm"><a href={`/api/files/evidence/${c.claimId}`} target="_blank" rel="noopener noreferrer"><FileText />Lihat bukti saya</a></Button>}
                  {c.claimStatus === "PENDING" && (
                    <ActionDialog trigger="Batalkan klaim" triggerVariant="ghost" title="Batalkan klaim ini?"
                      description="Barang akan kembali terbuka dan dapat diklaim pengguna lain. Anda masih bisa mengajukan klaim baru selama barang berstatus Terbuka."
                      submitLabel="Ya, batalkan klaim" submitVariant="danger" action={cancelClaimAction} hidden={{ claimId: c.claimId }} />
                  )}
                  {c.claimStatus === "NEED_INFO" && (
                    <ActionDialog trigger="Lengkapi informasi" triggerVariant="primary" title="Lengkapi informasi klaim"
                      description={<>Permintaan admin: <em>{c.adminNote}</em></>} submitLabel="Kirim informasi" action={respondInfoAction} hidden={{ claimId: c.claimId }}>
                      <Field name="claimNote" label="Informasi tambahan" as="textarea" rows={5} required minLength={10} maxLength={2000} />
                      <FileField name="evidence" label="Bukti baru" accept="image/jpeg,image/png,image/webp,application/pdf" maxMB={config.maxEvidenceBytes / 1048576}
                        hint="Mengunggah bukti baru akan menggantikan bukti sebelumnya." />
                    </ActionDialog>
                  )}
                </div>
              </CardBody></Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
