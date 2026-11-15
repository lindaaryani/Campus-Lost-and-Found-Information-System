import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { CLAIM_STATUSES, type ClaimStatus } from "@/lib/types";
import { CLAIM_STATUS_LABEL, USER_TYPE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { listClaimsForAdmin } from "@/modules/claims/service";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/shared/ui-bits";
import { ClaimStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Verifikasi Klaim" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const status = (CLAIM_STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as ClaimStatus) : undefined;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await listClaimsForAdmin(admin, { status, q, page });
  const tabs: { label: string; value?: ClaimStatus }[] = [{ label: "Semua" }, ...CLAIM_STATUSES.map((s) => ({ label: CLAIM_STATUS_LABEL[s], value: s }))];
  return (
    <>
      <PageHeader title="Verifikasi Klaim" description="Periksa klaim kepemilikan, bandingkan dengan ciri khusus laporan, lalu setujui, tolak, atau minta bukti tambahan." />
      <div className="mb-4 flex flex-wrap gap-2" role="navigation" aria-label="Filter status klaim">
        {tabs.map((t) => (
          <Button key={t.label} asChild size="sm" variant={t.value === status ? "primary" : "secondary"}>
            <Link href={t.value ? `/admin/klaim?status=${t.value}` : "/admin/klaim"} aria-current={t.value === status ? "page" : undefined}>{t.label}</Link>
          </Button>
        ))}
      </div>
      <form action="/admin/klaim" className="mb-5 flex max-w-md gap-2" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        <Input name="q" defaultValue={q} maxLength={100} placeholder="Cari nama barang atau pengaju…" aria-label="Cari klaim" />
        <Button type="submit" variant="secondary">Cari</Button>
      </form>
      {r.rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Tidak ada klaim" description="Tidak ada klaim yang cocok dengan filter ini." />
      ) : (
        <DataTable caption="Daftar klaim" headers={["Barang", "Pengaju", "Status", "Diajukan", ""]}>
          {r.rows.map((c) => (
            <tr key={c.claimId}>
              <td className="px-4 py-3"><p className="font-semibold">{c.itemName}</p><p className="text-xs text-muted">Klaim #{c.claimId}</p></td>
              <td className="px-4 py-3">{c.claimantName}<p className="text-xs text-muted">{c.claimantType ? USER_TYPE_LABEL[c.claimantType] : ""}</p></td>
              <td className="px-4 py-3"><ClaimStatusBadge status={c.claimStatus} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(c.submittedAt)}</td>
              <td className="px-4 py-3 text-right">
                <Button asChild size="sm" variant={c.claimStatus === "PENDING" ? "primary" : "secondary"}>
                  <Link href={`/admin/klaim/${c.claimId}`}>{c.claimStatus === "PENDING" ? "Periksa" : "Detail"}</Link>
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={r.page} pageCount={r.pageCount} basePath="/admin/klaim" params={{ status, q }} />
    </>
  );
}
