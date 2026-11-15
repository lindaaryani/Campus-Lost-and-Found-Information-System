import Link from "next/link";
import { FilePlus2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { USER_TYPE_LABEL } from "@/lib/labels";
import type { SessionUser } from "@/lib/types";
import { query } from "@/lib/db";
import { unreadCount } from "@/modules/notifications/service";
import { logoutAction } from "@/app/(auth)/actions";
import { ADMIN_NAV, USER_NAV } from "./nav";
import { MobileNav, Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ToastProvider } from "./toast";

/** Kerangka halaman untuk USER dan ADMIN: sidebar navy + top bar. */
export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const isAdmin = user.role === "ADMIN";
  const badges: Record<string, number> = {};
  if (isAdmin) {
    const [r] = await query<{ c: number }>("SELECT COUNT(*) AS c FROM claims WHERE claim_status = 'PENDING'");
    badges.claims = Number(r?.c ?? 0);
  } else {
    badges.notifications = await unreadCount(user.userId);
  }
  const items = isAdmin ? ADMIN_NAV : USER_NAV;
  const subtitle = isAdmin ? "Panel Administrator" : "ITB STIKOM Bali";
  const roleLabel = isAdmin ? "Administrator" : user.userType ? USER_TYPE_LABEL[user.userType] : "Pengguna";

  const quick = !isAdmin && (
    <div className="grid gap-2 pb-2">
      <Button asChild variant="primary" size="sm" className="bg-accent-red hover:bg-red-700"><Link href="/laporan/hilang/baru"><FilePlus2 />Lapor Kehilangan</Link></Button>
      <Button asChild variant="secondary" size="sm"><Link href="/laporan/ditemukan/baru"><PackagePlus />Lapor Temuan</Link></Button>
    </div>
  );

  return (
    <ToastProvider>
      <a href="#konten" className="sr-only z-[70] rounded-md bg-surface px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Lewati ke konten</a>
      <div className="flex min-h-screen">
        <Sidebar items={items} badges={badges} subtitle={subtitle}>{quick}</Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            name={user.fullName} roleLabel={roleLabel} unread={badges.notifications ?? 0} showSearch={!isAdmin} isAdmin={isAdmin}
            logoutAction={logoutAction}
            mobileNav={<MobileNav items={items} badges={badges} subtitle={subtitle}>{quick}</MobileNav>}
          />
          <main id="konten" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
