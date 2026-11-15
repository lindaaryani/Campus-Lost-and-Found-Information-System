import type { Metadata } from "next";
import { requireAdmin } from "@/lib/authz";
import { CLAIM_STATUS_LABEL, ITEM_STATUS_LABEL } from "@/lib/labels";
import { getStats } from "@/modules/admin/stats";
import { Legend, SimpleBars, StackedBars } from "@/components/shared/charts";
import { PageHeader, StatCard } from "@/components/shared/ui-bits";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, FileCheck2, PackageCheck, SearchX, ShieldCheck, Users } from "lucide-react";
import type { ClaimStatus, ItemStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Statistik" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

export default async function Page() {
  const admin = await requireAdmin();
  const s = await getStats(admin);
  const itemStatus = (["OPEN", "CLAIM_PENDING", "RETURNED", "CLOSED", "REJECTED"] as ItemStatus[]).map((st) => ({
    label: ITEM_STATUS_LABEL[st], value: s.itemsByStatus.filter((r) => r.status === st).reduce((a, r) => a + r.count, 0),
  }));
  const claimStatus = (["PENDING", "NEED_INFO", "APPROVED", "REJECTED", "CANCELLED"] as ClaimStatus[]).map((st) => ({
    label: CLAIM_STATUS_LABEL[st], value: s.claimsByStatus.find((r) => r.status === st)?.count ?? 0,
  }));
  return (
    <>
      <PageHeader title="Statistik" description="Gambaran laporan, klaim, dan penyelesaian barang di kampus." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total laporan" value={s.totals.items} icon={ClipboardList} />
        <StatCard label="Laporan kehilangan" value={s.totals.lost} icon={SearchX} tone="red" />
        <StatCard label="Laporan temuan" value={s.totals.found} icon={PackageCheck} />
        <StatCard label="Total klaim" value={s.totals.claims} icon={ShieldCheck} tone="yellow" />
        <StatCard label="Barang dikembalikan" value={s.totals.returned} icon={FileCheck2} tone="green" hint={s.returnRate !== null ? `${s.returnRate}% dari laporan temuan` : "Belum ada laporan temuan"} />
        <StatCard label="Pengguna terdaftar" value={s.totals.users} icon={Users} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Laporan per bulan</CardTitle><Legend /></CardHeader>
          <CardBody><StackedBars rows={s.monthly.map((m) => ({ label: monthLabel(m.month), lost: m.lost, found: m.found }))} /><p className="mt-4 text-xs text-muted">Enam bulan terakhir, berdasarkan tanggal laporan dibuat.</p></CardBody></Card>
        <Card><CardHeader><CardTitle>Status laporan</CardTitle></CardHeader><CardBody><SimpleBars rows={itemStatus} /></CardBody></Card>
        <Card><CardHeader><CardTitle>Laporan per kategori</CardTitle><Legend /></CardHeader><CardBody><StackedBars rows={s.byCategory.map((c) => ({ label: c.name, lost: c.lost, found: c.found }))} /></CardBody></Card>
        <Card><CardHeader><CardTitle>Laporan per lokasi</CardTitle><Legend /></CardHeader><CardBody><StackedBars rows={s.byLocation.map((c) => ({ label: c.name, lost: c.lost, found: c.found }))} /></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Status klaim</CardTitle></CardHeader><CardBody><SimpleBars rows={claimStatus} tone="bg-azure" /></CardBody></Card>
      </div>
    </>
  );
}
