import { CheckCircle2, CircleSlash } from "lucide-react";

export function Badge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success-100"><CheckCircle2 className="size-3.5" />Aktif</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200"><CircleSlash className="size-3.5" />Nonaktif</span>
  );
}
