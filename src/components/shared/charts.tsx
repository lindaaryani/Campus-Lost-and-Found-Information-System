import { cn } from "@/lib/utils";

/** Bilah horizontal bertumpuk (hilang vs ditemukan) — CSS murni, ada label angka sehingga tidak bergantung warna. */
export function StackedBars({ rows, max }: { rows: { label: string; lost: number; found: number }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.lost + r.found));
  if (rows.length === 0) return <p className="text-sm text-muted">Belum ada data.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted">{r.lost} hilang · {r.found} temuan</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${r.label}: ${r.lost} hilang, ${r.found} ditemukan`}>
            <div className="bg-accent-red" style={{ width: `${(r.lost / top) * 100}%` }} />
            <div className="bg-primary" style={{ width: `${(r.found / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Legend() {
  return (
    <p className="flex gap-4 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent-red" />Hilang</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />Ditemukan</span>
    </p>
  );
}

export function SimpleBars({ rows, tone = "bg-primary" }: { rows: { label: string; value: number; className?: string }[]; tone?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{r.label}</span><span className="tabular-nums text-muted">{r.value}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", r.className ?? tone)} style={{ width: `${(r.value / top) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
