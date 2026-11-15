"use client";
import Link from "next/link";
import { Lock } from "lucide-react";
import { ActionForm, Field, FileField, SubmitButton } from "./forms";
import { Button } from "@/components/ui/button";
import type { ActionState, ItemType } from "@/lib/types";

interface Props {
  type: ItemType;
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  categories: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  today: string;
  maxPhotoMB: number;
  submitLabel: string;
  cancelHref: string;
  edit?: {
    itemId: number; itemName: string; categoryId: number; locationId: number; color: string | null; description: string | null;
    incidentDate: string; privateIdentifier: string | null; hasPhoto: boolean;
  };
}

export function ItemForm({ type, action, categories, locations, today, maxPhotoMB, submitLabel, cancelHref, edit }: Props) {
  const lost = type === "LOST";
  return (
    <ActionForm action={action} successToast={false} className="space-y-6">
      <input type="hidden" name="itemType" value={type} />
      {edit && <input type="hidden" name="itemId" value={edit.itemId} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="itemName" label="Nama barang" required minLength={3} maxLength={150} defaultValue={edit?.itemName}
          placeholder={lost ? "Contoh: Dompet kulit coklat" : "Contoh: Kunci motor Honda"} className="sm:col-span-2" />
        <Field name="categoryId" label="Kategori" as="select" required defaultValue={edit?.categoryId ?? ""}>
          <option value="" disabled>Pilih kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Field>
        <Field name="locationId" label={lost ? "Lokasi terakhir terlihat" : "Lokasi ditemukan"} as="select" required defaultValue={edit?.locationId ?? ""}>
          <option value="" disabled>Pilih lokasi</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Field>
        <Field name="color" label="Warna" required minLength={2} maxLength={60} defaultValue={edit?.color} placeholder="Contoh: Hitam, biru tua" hint="Warna dipakai untuk mencocokkan laporan." />
        <Field name="incidentDate" label={lost ? "Tanggal kehilangan" : "Tanggal ditemukan"} type="date" required max={today} min="2020-01-01" defaultValue={edit?.incidentDate?.slice(0, 10) ?? today} />
        <Field name="description" label="Deskripsi barang" as="textarea" rows={4} required minLength={10} maxLength={2000} defaultValue={edit?.description}
          hint="Merek, ukuran, kondisi, atau ciri lain yang terlihat. Ditampilkan ke pengguna lain." className="sm:col-span-2" />
      </div>

      <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Lock className="size-4" />Informasi rahasia untuk verifikasi</div>
        <Field name="privateIdentifier" label="Ciri khusus" as="textarea" rows={3} maxLength={1000} required={!lost} defaultValue={edit?.privateIdentifier}
          hint={lost
            ? "Contoh: isi dompet, goresan, atau stiker tertentu. Hanya Anda dan admin yang bisa melihat ini."
            : "Sesuatu yang hanya diketahui pemilik asli (isi tas, goresan, nomor seri). Tidak ditampilkan ke pengguna lain; dipakai admin untuk memverifikasi klaim."} />
      </div>

      <div>
        <FileField name="photo" label="Foto barang" accept="image/jpeg,image/png,image/webp" maxMB={maxPhotoMB} hint={`JPG, PNG, atau WebP, maksimal ${maxPhotoMB} MB.`} />
        {edit?.hasPhoto && (
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="removePhoto" className="size-4 rounded border-line accent-primary" />
            Hapus foto saat ini (atau unggah foto baru untuk menggantinya)
          </label>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <Button asChild variant="secondary"><Link href={cancelHref}>Batal</Link></Button>
        <SubmitButton pendingText="Menyimpan…">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
