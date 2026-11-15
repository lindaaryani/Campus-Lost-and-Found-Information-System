import { exec, query } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { AdminError } from "./users";
import type { SessionUser } from "@/lib/types";

/** Peta tetap (konstanta kode, bukan input pengguna) => nama tabel/kolom aman dari injection. */
const KINDS = {
  category: { table: "categories", id: "category_id", name: "category_name", label: "Kategori", itemCol: "category_id" },
  location: { table: "locations", id: "location_id", name: "location_name", label: "Lokasi", itemCol: "location_id" },
} as const;
export type MasterKind = keyof typeof KINDS;

export interface MasterRow {
  id: number; name: string; description: string | null; isActive: boolean; createdAt: string; usage: number;
}

/** FR-22 (lihat/daftar). */
export async function listMaster(kind: MasterKind): Promise<MasterRow[]> {
  const k = KINDS[kind];
  const rows = await query<{ id: number; name: string; description: string | null; is_active: number; created_at: string; usage_count: number }>(
    `SELECT m.${k.id} AS id, m.${k.name} AS name, m.description, m.is_active, m.created_at,
            (SELECT COUNT(*) FROM items i WHERE i.${k.itemCol} = m.${k.id}) AS usage_count
       FROM ${k.table} m ORDER BY m.is_active DESC, m.${k.name} ASC`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, isActive: !!r.is_active, createdAt: r.created_at, usage: Number(r.usage_count) }));
}

function dupMessage(kind: MasterKind) {
  return `${KINDS[kind].label} dengan nama tersebut sudah ada.`;
}

/** FR-22 (tambah). */
export async function createMaster(admin: SessionUser, kind: MasterKind, name: string, description: string | null) {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  const k = KINDS[kind];
  try {
    const res = await exec(`INSERT INTO ${k.table} (${k.name}, description) VALUES (?, ?)`, [name, description]);
    await writeAudit(admin.userId, "MASTER_CREATED", kind, res.insertId, { name });
    return res.insertId;
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new AdminError(dupMessage(kind));
    throw e;
  }
}

/** FR-22 (ubah). */
export async function updateMaster(admin: SessionUser, kind: MasterKind, id: number, name: string, description: string | null) {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  const k = KINDS[kind];
  try {
    const res = await exec(`UPDATE ${k.table} SET ${k.name} = ?, description = ? WHERE ${k.id} = ?`, [name, description, id]);
    if (res.affectedRows === 0) throw new AdminError(`${k.label} tidak ditemukan.`);
    await writeAudit(admin.userId, "MASTER_UPDATED", kind, id, { name });
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new AdminError(dupMessage(kind));
    throw e;
  }
}

/** FR-22 (nonaktifkan / aktifkan kembali). Data tidak dihapus agar laporan lama tetap utuh. */
export async function setMasterActive(admin: SessionUser, kind: MasterKind, id: number, active: boolean) {
  if (admin.role !== "ADMIN") throw new AdminError("Tidak berwenang.");
  const k = KINDS[kind];
  const res = await exec(`UPDATE ${k.table} SET is_active = ? WHERE ${k.id} = ?`, [active ? 1 : 0, id]);
  if (res.affectedRows === 0) throw new AdminError(`${k.label} tidak ditemukan.`);
  await writeAudit(admin.userId, active ? "MASTER_ACTIVATED" : "MASTER_DEACTIVATED", kind, id);
}
