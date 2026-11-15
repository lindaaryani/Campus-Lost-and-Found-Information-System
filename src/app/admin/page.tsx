import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FileCheck2, PackageCheck, SearchX, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { getStats } from "@/modules/admin/stats";
import { listClaimsForAdmin } from "@/modules/claims/service";
import { listAuditLogs } from "@/modules/admin/logs";
import { Alert, EmptyState, PageHeader, StatCard } from "@/components/shared/ui-bits";
import { ClaimStatusBadge } from "@/components/shared/badges";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTION_LABEL } from "@/components/shared/audit-labels";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard Admin" };

export default async function Page() {
  const admin = await requireAdmin();
  const [s, pending, logs] = await Promise.all([getStats(admin), listClaimsForAdmin(admin, { status: "PENDING" }), listAuditLogs(admin, {})]);
  return (
    <>
      <PageHeader title="Dashboard Admin" description="Ringkasan sistem dan pekerjaan yang menunggu tindakan." />
      {s.totals.pendingClaims > 0 && (
        <Alert tone="warning" className="mb-5" title={`${s.totals.pendingClaims} klaim menunggu tindakan`}>
          <Link href="/admin/klaim" className="font-semibold underline">Buka antrean verifikasi</Link>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Klaim menunggu tindakan" value={s.totals.pendingClaims} icon={ShieldCheck} tone="yellow" href="/admin/klaim" />
        <StatCard label="Laporan kehilangan" value={s.totals.lost} icon={SearchX} tone="red" href="/admin/laporan?type=LOST" />
        <StatCard label="Laporan temuan" value={s.totals.found} icon={PackageCheck} tone="blue" href="/admin/laporan?type=FOUND" />
        <StatCard label="Barang dikembalikan" value={s.totals.returned} icon={FileCheck2} tone="green" hint={s.returnRate !== null ? `${s.returnRate}% dari laporan temuan` : undefined} />
        <StatCard label="Pengguna terdaftar" value={s.totals.users} icon={Users} tone="blue" href="/admin/pengguna" />
        <StatCard label="Total laporan" value={s.totals.items} icon={ClipboardList} tone="blue" href="/admin/laporan" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Antrean klaim</CardTitle><Link href="/admin/klaim" className="text-xs font-semibold text-primary hover:underline">Semua klaim</Link></CardHeader>
          <CardBody className="space-y-3">
            {pending.rows.length === 0 ? <EmptyState icon={ShieldCheck} title="Antrean kosong" description="Tidak ada klaim yang menunggu pemeriksaan." /> :
              pending.rows.slice(0, 5).map((c) => (
                <Link key={c.claimId} href={`/admin/klaim/${c.claimId}`} className="flex items-center justify-between gap-3 rounded-md border border-line p-3 hover:border-primary-100 hover:bg-primary-50/40">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{c.itemName}</p><p className="text-xs text-muted">{c.claimantName} · {relativeTime(c.submittedAt)}</p></div>
                  <ClaimStatusBadge status={c.claimStatus} />
                </Link>
              ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Aktivitas terbaru</CardTitle><Link href="/admin/log" className="text-xs font-semibold text-primary hover:underline">Semua log</Link></CardHeader>
          <CardBody className="space-y-3.5">
            {logs.rows.length === 0 ? <p className="text-sm text-muted">Belum ada aktivitas.</p> : logs.rows.slice(0, 6).map((l) => (
              <div key={l.logId} className="text-sm"><p className="font-semibold">{ACTION_LABEL[l.action] ?? l.action}</p>
                <p className="text-xs text-muted">{l.actorName ?? "Sistem"} · {formatDateTime(l.createdAt)}</p></div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
