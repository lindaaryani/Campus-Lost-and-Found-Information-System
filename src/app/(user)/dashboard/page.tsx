import type { Metadata } from "next";
import Link from "next/link";
import { Bell, FileCheck2, FilePlus2, PackageCheck, PackagePlus, SearchX, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { getUserDashboard } from "@/modules/items/dashboard";
import { listItems } from "@/modules/items/service";
import { listMatchesForUser } from "@/modules/matching/service";
import { recentNotifications } from "@/modules/notifications/service";
import { Alert, EmptyState, PageHeader, StatCard } from "@/components/shared/ui-bits";
import { ItemCard } from "@/components/shared/item-card";
import { MatchList } from "@/components/shared/match-list";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Page() {
  const user = await requireUser();
  const [d, matches, notifs, mine] = await Promise.all([
    getUserDashboard(user.userId),
    listMatchesForUser(user.userId),
    recentNotifications(user.userId, 4),
    listItems("mine", user, {}),
  ]);
  const first = user.fullName.split(" ")[0];
  return (
    <>
      <PageHeader title={`Halo, ${first}`} description="Ringkasan laporan, klaim, dan rekomendasi Anda."
        actions={<><Button asChild className="bg-accent-red hover:bg-red-700"><Link href="/laporan/hilang/baru"><FilePlus2 />Lapor Kehilangan</Link></Button>
          <Button asChild variant="secondary"><Link href="/laporan/ditemukan/baru"><PackagePlus />Lapor Temuan</Link></Button></>} />

      {d.needInfoClaims > 0 && (
        <Alert tone="warning" title="Admin meminta bukti tambahan" className="mb-5">
          Ada {d.needInfoClaims} klaim yang menunggu informasi dari Anda. <Link href="/klaim" className="font-semibold underline">Lengkapi sekarang</Link>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Kehilangan aktif" value={d.lostOpen} icon={SearchX} tone="red" href="/laporan-saya?type=LOST&status=OPEN" />
        <StatCard label="Temuan aktif" value={d.foundOpen} icon={PackageCheck} tone="blue" href="/laporan-saya?type=FOUND" />
        <StatCard label="Klaim berjalan" value={d.activeClaims} icon={FileCheck2} tone="yellow" href="/klaim" />
        <StatCard label="Rekomendasi" value={matches.filter((m) => m.status === "SUGGESTED").length} icon={Sparkles} tone="green" href="/rekomendasi" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="rek" className="space-y-4">
          <div className="flex items-center justify-between"><h2 id="rek" className="text-lg font-bold">Rekomendasi terbaru</h2>
            {matches.length > 0 && <Link href="/rekomendasi" className="text-sm font-semibold text-primary hover:underline">Lihat semua</Link>}</div>
          {matches.length === 0 ? (
            <EmptyState icon={Sparkles} title="Belum ada rekomendasi" description="Buat laporan kehilangan atau temuan. Sistem akan mencarikan laporan lain yang mirip." />
          ) : <MatchList matches={matches.slice(0, 2)} />}

          <div className="flex items-center justify-between pt-4"><h2 className="text-lg font-bold">Laporan terakhir saya</h2>
            {mine.total > 0 && <Link href="/laporan-saya" className="text-sm font-semibold text-primary hover:underline">Lihat semua</Link>}</div>
          {mine.items.length === 0 ? (
            <p className="text-sm text-muted">Anda belum membuat laporan.</p>
          ) : <div className="grid gap-5 sm:grid-cols-2">{mine.items.slice(0, 2).map((i) => <ItemCard key={i.itemId} item={i} />)}</div>}
        </section>

        <aside>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4 text-muted" />Notifikasi terbaru</CardTitle>
              <Link href="/notifikasi" className="text-xs font-semibold text-primary hover:underline">Semua</Link></CardHeader>
            <CardBody className="space-y-4">
              {notifs.length === 0 ? <p className="text-sm text-muted">Belum ada notifikasi.</p> : notifs.map((n) => (
                <div key={n.notification_id} className="flex gap-2.5">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${n.is_read ? "bg-slate-300" : "bg-accent-red"}`} />
                  <div className="min-w-0"><p className="text-sm font-semibold">{n.title}</p><p className="line-clamp-2 text-xs text-muted">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted/80">{relativeTime(n.created_at)}</p></div>
                </div>
              ))}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
