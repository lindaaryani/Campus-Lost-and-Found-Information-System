import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { relativeTime } from "@/lib/utils";
import { listNotifications } from "@/modules/notifications/service";
import { EmptyState, PageHeader, Pagination } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const onlyUnread = sp.filter === "belum-dibaca";
  const r = await listNotifications(user.userId, { page, onlyUnread });
  return (
    <>
      <PageHeader title="Notifikasi" description="Pembaruan tentang rekomendasi, klaim, dan status laporan Anda."
        actions={<form action={markAllNotificationsReadAction}><Button type="submit" variant="secondary"><CheckCheck />Tandai semua dibaca</Button></form>} />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filter notifikasi">
        <Button asChild size="sm" variant={onlyUnread ? "ghost" : "primary"}><Link href="/notifikasi">Semua</Link></Button>
        <Button asChild size="sm" variant={onlyUnread ? "primary" : "ghost"}><Link href="/notifikasi?filter=belum-dibaca">Belum dibaca</Link></Button>
      </div>
      {r.rows.length === 0 ? (
        <EmptyState icon={Bell} title={onlyUnread ? "Tidak ada notifikasi baru" : "Belum ada notifikasi"} description="Anda akan diberi tahu di sini saat ada rekomendasi atau keputusan klaim." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {r.rows.map((n) => {
            const href = n.claim_id ? "/klaim" : n.item_id ? `/barang/${n.item_id}` : null;
            const unread = !n.is_read;
            return (
              <div key={n.notification_id} className={`flex items-start gap-3 p-4 ${unread ? "bg-primary-50/50" : ""}`}>
                <span className={`mt-2 size-2.5 shrink-0 rounded-full ${unread ? "bg-accent-red" : "bg-transparent"}`} aria-label={unread ? "Belum dibaca" : undefined} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <time>{relativeTime(n.created_at)}</time>
                    {href && <Link href={href} className="font-semibold text-primary hover:underline">Buka</Link>}
                  </div>
                </div>
                {unread && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={n.notification_id} />
                    <Button type="submit" size="sm" variant="ghost">Tandai dibaca</Button>
                  </form>
                )}
              </div>
            );
          })}
        </Card>
      )}
      <Pagination page={r.page} pageCount={r.pageCount} basePath="/notifikasi" params={{ filter: onlyUnread ? "belum-dibaca" : undefined }} />
    </>
  );
}
