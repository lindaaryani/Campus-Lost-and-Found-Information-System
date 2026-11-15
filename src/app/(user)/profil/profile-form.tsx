"use client";
import { ActionForm, Field, SubmitButton } from "@/components/shared/forms";
import { updateProfileAction } from "@/app/(user)/actions";

export function ProfileForm({ fullName, email, phone }: { fullName: string; email: string; phone: string | null }) {
  return (
    <ActionForm action={updateProfileAction} className="space-y-4">
      <Field name="fullName" label="Nama lengkap" required minLength={3} maxLength={120} defaultValue={fullName} autoComplete="name" />
      <Field name="email" label="Email" type="email" required maxLength={150} defaultValue={email} autoComplete="email" />
      <Field name="phoneNumber" label="Nomor telepon" type="tel" inputMode="tel" maxLength={20} defaultValue={phone} autoComplete="tel" />
      <div className="flex justify-end pt-2"><SubmitButton pendingText="Menyimpan…">Simpan perubahan</SubmitButton></div>
    </ActionForm>
  );
}
