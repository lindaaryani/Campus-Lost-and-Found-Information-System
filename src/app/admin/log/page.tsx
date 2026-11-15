import type { Metadata } from "next";
import { History } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { formatDateTime } from "@/lib/utils";
import { listAuditLogs } from "@/modules/admin/logs";
import { ACTION_LABEL, ENTITY_LABEL } from "@/components/shared/audit-labels";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ITEM_STATUS_LABEL, CLAIM_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Log Aktivitas" };

const VALUE_LABELS: Record<string, string> = { ...ITEM_STATUS_LABEL, ...CLAIM_STATUS_LABEL, ACTIVE: "Aktif", INACTIVE: "Nonaktif", SUSPENDED: "Ditangguhkan" };
const KEY_LABELS: Record<string, string> = { from: "dari", to: "ke", note: "catatan", decision: "keputusan", itemId: "laporan", claimId: "klaim", type: "jenis", name: "nama", by: "oleh", userType: "tipe" };

function summarize(d: Record<string, unknown> | null): string {
  if (!d) return "";
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== "")
    .map(([k, v]) => `${KEY_LABELS[k] ?? k}: ${VALUE_LABELS[String(v)] ?? String(v)}`)
    .join(" · ");
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await listAuditLogs(admin, { action: sp.action, entity: sp.entity, page });
  return (
    <>
      <PageHeader title="Log Aktivitas" description="Jejak perubahan status laporan, keputusan klaim, dan tindakan administratif: siapa, apa, dan kapan." />
      <form action="/admin/log" className="mb-5 flex flex-wrap items-end gap-3">
        <div><label htmlFor="l-a" className="mb-1 block text-xs font-semibold text-muted">Aktivitas</label>
          <Select id="l-a" name="action" defaultValue={sp.action ?? ""} className="w-56"><option value="">Semua aktivitas</option>
            {r.actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}</Select></div>
        <div><label htmlFor="l-e" className="mb-1 block text-xs font-semibold text-muted">Objek</label>
          <Select id="l-e" name="entity" defaultValue={sp.entity ?? ""} className="w-44"><option value="">Semua objek</option>
            {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <Button type="submit" variant="secondary">Terapkan</Button>
      </form>
      {r.rows.length === 0 ? <EmptyState icon={History} title="Belum ada aktivitas" description="Aktivitas penting akan tercatat di sini." /> : (
        <DataTable caption="Log aktivitas sistem" headers={["Waktu", "Pelaku", "Aktivitas", "Objek", "Rincian"]}>
          {r.rows.map((l) => (
            <tr key={l.logId} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(l.createdAt)}</td>
              <td className="px-4 py-3">{l.actorName ?? <span className="text-muted">Sistem</span>}</td>
              <td className="px-4 py-3 font-semibold">{ACTION_LABEL[l.action] ?? l.action}</td>
              <td className="whitespace-nowrap px-4 py-3">{ENTITY_LABEL[l.entityType] ?? l.entityType}{l.entityId ? ` #${l.entityId}` : ""}</td>
              <td className="max-w-xs px-4 py-3 text-xs text-muted">{summarize(l.details)}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={r.page} pageCount={r.pageCount} basePath="/admin/log" params={{ action: sp.action, entity: sp.entity }} />
    </>
  );
}
