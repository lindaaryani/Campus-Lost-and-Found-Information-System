"use client";
import Link from "next/link";
import { ActionForm, Field, FileField, SubmitButton } from "@/components/shared/forms";
import { Button } from "@/components/ui/button";
import { submitClaimAction } from "@/app/(user)/actions";

export function ClaimForm({ itemId, maxEvidenceMB }: { itemId: number; maxEvidenceMB: number }) {
  return (
    <ActionForm action={submitClaimAction} successToast={false} className="space-y-5">
      <input type="hidden" name="itemId" value={itemId} />
      <Field name="claimNote" label="Catatan klaim" as="textarea" rows={6} required minLength={20} maxLength={2000}
        hint="Jelaskan mengapa barang ini milik Anda: ciri khusus, isi, tanda unik, kapan dan di mana hilang. Jangan ungkapkan ciri yang sudah tertulis jelas di laporan agar mudah diverifikasi." />
      <FileField name="evidence" label="Bukti kepemilikan" accept="image/jpeg,image/png,image/webp,application/pdf" maxMB={maxEvidenceMB}
        hint={`Foto barang sebelum hilang, nota pembelian, atau tangkapan layar. JPG, PNG, WebP, atau PDF, maksimal ${maxEvidenceMB} MB. Hanya Anda dan admin yang dapat melihatnya.`} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <Button asChild variant="secondary"><Link href={`/barang/${itemId}`}>Batal</Link></Button>
        <SubmitButton pendingText="Mengirim klaim…">Kirim klaim</SubmitButton>
      </div>
    </ActionForm>
  );
}
