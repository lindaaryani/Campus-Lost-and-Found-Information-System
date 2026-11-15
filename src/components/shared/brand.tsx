import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Logo CampusFind: kaca pembesar pada petak biru dengan titik merah & kuning (identitas kampus). */
export function BrandMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-lg", onDark ? "bg-white text-primary" : "bg-primary text-white", className)} aria-hidden>
      <Search className="size-[18px]" strokeWidth={2.5} />
      <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-accent-red ring-2 ring-white" />
      <span className="absolute -bottom-1 -right-0.5 size-2 rounded-full bg-accent-yellow ring-2 ring-white" />
    </span>
  );
}

export function Brand({ tone = "dark", sub = "ITB STIKOM Bali" }: { tone?: "dark" | "light"; sub?: string }) {
  return (
    <span className="flex items-center gap-3">
      <BrandMark onDark={tone === "light"} />
      <span className="leading-tight">
        <span className={cn("block text-base font-bold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>CampusFind</span>
        <span className={cn("block text-xs", tone === "light" ? "text-white/65" : "text-muted")}>{sub}</span>
      </span>
    </span>
  );
}
