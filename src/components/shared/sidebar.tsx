"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, ClipboardList, FileCheck2, History, LayoutDashboard, Menu, MapPin, PackageCheck, Search,
  SearchX, ShieldCheck, Sparkles, Tags, BarChart3, User, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import type { NavItem } from "./nav";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: LayoutDashboard, searchx: SearchX, package: PackageCheck, search: Search, clipboard: ClipboardList,
  sparkles: Sparkles, filecheck: FileCheck2, bell: Bell, user: User, shield: ShieldCheck, users: Users,
  tags: Tags, mappin: MapPin, chart: BarChart3, history: History,
};

function NavList({ items, badges, onNavigate }: { items: NavItem[]; badges: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        const Icon = ICONS[it.icon] ?? LayoutDashboard;
        const count = it.badge ? badges[it.badge] ?? 0 : 0;
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-white/12 text-white shadow-[inset_3px_0_0_var(--yellow)]" : "text-white/75 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="flex-1">{it.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-accent-yellow px-2 py-0.5 text-xs font-bold text-navy" aria-label={`${count} baru`}>{count > 99 ? "99+" : count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, badges, subtitle, children }: { items: NavItem[]; badges: Record<string, number>; subtitle: string; children?: React.ReactNode }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-navy lg:flex">
      <div className="tri-stripe" />
      <div className="px-5 py-5"><Brand tone="light" sub={subtitle} /></div>
      {children && <div className="px-3 pb-2">{children}</div>}
      <NavList items={items} badges={badges} />
    </aside>
  );
}

export function MobileNav({ items, badges, subtitle, children }: { items: NavItem[]; badges: Record<string, number>; subtitle: string; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  // Tutup drawer saat rute berubah (pola "sesuaikan state saat render", tanpa effect).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); }
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md p-2 text-ink hover:bg-primary-50 lg:hidden" aria-label="Buka menu" aria-expanded={open}>
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy">
            <div className="tri-stripe" />
            <div className="flex items-center justify-between px-5 py-4">
              <Brand tone="light" sub={subtitle} />
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-white/80 hover:bg-white/10" aria-label="Tutup menu"><X className="size-5" /></button>
            </div>
            {children && <div className="px-3 pb-2">{children}</div>}
            <NavList items={items} badges={badges} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
