import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-surface px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary-50 text-primary"><Icon className="size-6" /></div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ALERT = {
  info: ["border-primary-100 bg-primary-50 text-navy", Info],
  success: ["border-success-100 bg-success-50 text-success", CheckCircle2],
  warning: ["border-yellow-100 bg-yellow-50 text-navy", AlertCircle],
  error: ["border-red-100 bg-red-50 text-red-700", AlertCircle],
} as const;
export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof ALERT; title?: string; children: React.ReactNode; className?: string }) {
  const [cls, Icon] = ALERT[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cn("flex items-start gap-3 rounded-md border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{title && <p className="font-semibold">{title}</p>}<div className={title ? "mt-0.5" : ""}>{children}</div></div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "blue", hint, href }: {
  label: string; value: React.ReactNode; icon: LucideIcon; tone?: "blue" | "red" | "yellow" | "green"; hint?: string; href?: string;
}) {
  const tones = { blue: "bg-primary-50 text-primary", red: "bg-red-50 text-red-700", yellow: "bg-yellow-100 text-navy", green: "bg-success-50 text-success" };
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-primary-100 sm:gap-4 sm:p-4">
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg sm:size-11", tones[tone])}><Icon className="size-5" /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1.5 text-sm text-muted">{label}</p>
        {hint && <p className="text-xs text-muted/80">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-lg">{inner}</Link> : inner;
}

/** Pagination berbasis URL (server-render). `params` = query lain yang dipertahankan. */
export function Pagination({ page, pageCount, basePath, params = {} }: { page: number; pageCount: number; basePath: string; params?: Record<string, string | undefined> }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Navigasi halaman" className="mt-6 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">Halaman {page} dari {pageCount}</p>
      <div className="flex gap-2">
        <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""} aria-disabled={page <= 1}>
          <Link href={href(Math.max(1, page - 1))} tabIndex={page <= 1 ? -1 : 0}><ChevronLeft />Sebelumnya</Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className={page >= pageCount ? "pointer-events-none opacity-50" : ""} aria-disabled={page >= pageCount}>
          <Link href={href(Math.min(pageCount, page + 1))} tabIndex={page >= pageCount ? -1 : 0}>Berikutnya<ChevronRight /></Link>
        </Button>
      </div>
    </nav>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-semibold text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{i.value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataTable({ headers, children, caption }: { headers: string[]; children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-slate-50/80 text-xs font-semibold text-muted">
          <tr>{headers.map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
