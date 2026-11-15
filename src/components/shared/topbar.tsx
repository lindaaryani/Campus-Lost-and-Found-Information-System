"use client";
import Link from "next/link";
import { Bell, LogOut, Search, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

export function Topbar({
  name, roleLabel, unread, showSearch, isAdmin, logoutAction, mobileNav,
}: {
  name: string; roleLabel: string; unread: number; showSearch: boolean; isAdmin: boolean;
  logoutAction: () => Promise<void>; mobileNav: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
      {mobileNav}
      {showSearch ? (
        <form action="/cari" role="search" className="relative hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q" type="search" maxLength={100} placeholder="Cari barang: dompet, tas, kunci…" aria-label="Cari barang"
            className="h-10 w-full rounded-md border border-line bg-background pl-9 pr-3 text-sm placeholder:text-muted hover:border-slate-300 focus-visible:border-azure"
          />
        </form>
      ) : <div className="flex-1" />}
      <div className="ml-auto flex items-center gap-1.5">
        {!isAdmin && (
          <Link href="/notifikasi" className="relative rounded-md p-2.5 text-ink hover:bg-primary-50" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}>
            <Bell className="size-[18px]" />
            {unread > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-accent-yellow px-1 text-[10px] font-bold leading-4 text-navy ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-2.5 hover:bg-primary-50" aria-label="Menu akun">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-white">{initials(name)}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-36 truncate text-sm font-semibold">{name}</span>
              <span className="block text-xs text-muted">{roleLabel}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Masuk sebagai {roleLabel}</DropdownMenuLabel>
            {!isAdmin && (
              <DropdownMenuItem asChild><Link href="/profil"><UserRound />Profil saya</Link></DropdownMenuItem>
            )}
            {!isAdmin && <DropdownMenuSeparator />}
            <form action={logoutAction}>
              {/* preventDefault: jangan tutup/unmount menu sebelum form sempat terkirim */}
              <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}><button type="submit" className="w-full"><LogOut />Keluar</button></DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
