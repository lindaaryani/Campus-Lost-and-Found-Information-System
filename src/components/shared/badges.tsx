import {
  Ban, CheckCircle2, CircleDashed, CircleSlash, Clock3, HelpCircle, Lock, PackageCheck, PackageSearch,
  SearchX, ShieldAlert, ShieldCheck, Sparkles, Undo2, XCircle, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_STATUS_LABEL, CLAIM_STATUS_LABEL, ITEM_STATUS_LABEL, ITEM_TYPE_LABEL, MATCH_STATUS_LABEL,
} from "@/lib/labels";
import type { AccountStatus, ClaimStatus, ItemStatus, ItemType, MatchStatus } from "@/lib/types";

const TONES = {
  red: "bg-red-50 text-red-700 ring-red-100",
  redOutline: "bg-surface text-red-700 ring-red-700/60",
  blue: "bg-primary-50 text-primary ring-primary-100",
  yellow: "bg-yellow-50 text-navy ring-yellow-100",
  green: "bg-success-50 text-success ring-success-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-100",
} as const;
type Tone = keyof typeof TONES;

function Badge({ tone, icon: Icon, children, className }: { tone: Tone; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", TONES[tone], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

const ITEM_TYPE: Record<ItemType, [Tone, LucideIcon]> = { LOST: ["red", SearchX], FOUND: ["blue", PackageCheck] };
export const ItemTypeBadge = ({ type, className }: { type: ItemType; className?: string }) => (
  <Badge tone={ITEM_TYPE[type][0]} icon={ITEM_TYPE[type][1]} className={className}>{ITEM_TYPE_LABEL[type]}</Badge>
);

const ITEM_STATUS: Record<ItemStatus, [Tone, LucideIcon]> = {
  OPEN: ["blue", CircleDashed], CLAIM_PENDING: ["yellow", Clock3], RETURNED: ["green", Undo2],
  CLOSED: ["slate", Lock], REJECTED: ["redOutline", Ban],
};
export const ItemStatusBadge = ({ status, className }: { status: ItemStatus; className?: string }) => (
  <Badge tone={ITEM_STATUS[status][0]} icon={ITEM_STATUS[status][1]} className={className}>{ITEM_STATUS_LABEL[status]}</Badge>
);

const CLAIM_STATUS: Record<ClaimStatus, [Tone, LucideIcon]> = {
  PENDING: ["yellow", Clock3], NEED_INFO: ["sky", HelpCircle], APPROVED: ["green", CheckCircle2],
  REJECTED: ["redOutline", XCircle], CANCELLED: ["slate", CircleSlash],
};
export const ClaimStatusBadge = ({ status, className }: { status: ClaimStatus; className?: string }) => (
  <Badge tone={CLAIM_STATUS[status][0]} icon={CLAIM_STATUS[status][1]} className={className}>{CLAIM_STATUS_LABEL[status]}</Badge>
);

const MATCH_STATUS: Record<MatchStatus, [Tone, LucideIcon]> = {
  SUGGESTED: ["blue", Sparkles], CONFIRMED: ["green", CheckCircle2], DISMISSED: ["slate", CircleSlash],
};
export const MatchStatusBadge = ({ status }: { status: MatchStatus }) => (
  <Badge tone={MATCH_STATUS[status][0]} icon={MATCH_STATUS[status][1]}>{MATCH_STATUS_LABEL[status]}</Badge>
);

const ACCOUNT: Record<AccountStatus, [Tone, LucideIcon]> = {
  ACTIVE: ["green", ShieldCheck], INACTIVE: ["slate", CircleSlash], SUSPENDED: ["red", ShieldAlert],
};
export const AccountStatusBadge = ({ status }: { status: AccountStatus }) => (
  <Badge tone={ACCOUNT[status][0]} icon={ACCOUNT[status][1]}>{ACCOUNT_STATUS_LABEL[status]}</Badge>
);

/** Skor kemiripan: angka + bilah; bukan bukti kepemilikan (BR-10). */
export function ScoreMeter({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-success" : score >= 60 ? "bg-primary" : "bg-azure/70";
  return (
    <div className="flex items-center gap-2" aria-label={`Kemiripan ${score.toFixed(0)} persen`}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums text-ink">{score.toFixed(0)}%</span>
    </div>
  );
}

export { PackageSearch };
