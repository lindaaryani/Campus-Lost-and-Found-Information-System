"use client";
import * as React from "react";
import Link from "next/link";
import { ActionForm, Field, SubmitButton, useFormState } from "@/components/shared/forms";
import { IDENTITY_OPTIONS, IDENTITY_TYPE_LABEL, USER_TYPE_LABEL } from "@/lib/labels";
import { USER_TYPES, type IdentityType, type UserType } from "@/lib/types";
import { registerAction } from "../actions";

function Fields() {
  const state = useFormState();
  const [userType, setUserType] = React.useState<UserType>((state?.values?.userType as UserType) ?? "STUDENT");
  const [idType, setIdType] = React.useState<IdentityType>("NIM");
  const options = IDENTITY_OPTIONS[userType];
  const effective = options.includes(idType) ? idType : options[0];
  return (
    <div className="space-y-4">
      <Field name="userType" label="Saya adalah" as="select" required value={userType} onChange={(e) => setUserType(e.target.value as UserType)}
        options={USER_TYPES.map((u) => ({ value: u, label: USER_TYPE_LABEL[u] }))} />
      {options.length > 1 ? (
        <Field name="identityType" label="Jenis identitas" as="select" required value={effective} onChange={(e) => setIdType(e.target.value as IdentityType)}
          options={options.map((o) => ({ value: o, label: IDENTITY_TYPE_LABEL[o] }))} />
      ) : <input type="hidden" name="identityType" value={options[0]} />}
      <Field name="identityNumber" label={`Nomor ${IDENTITY_TYPE_LABEL[effective]}`} required maxLength={40} minLength={4}
        inputMode={effective === "NIM" ? "numeric" : "text"} autoComplete="off" />
      <Field name="fullName" label="Nama lengkap" required minLength={3} maxLength={120} autoComplete="name" />
      <Field name="email" label="Email" type="email" required maxLength={150} autoComplete="email" />
      <Field name="phoneNumber" label="Nomor telepon" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" hint="Dipakai admin bila perlu menghubungi Anda." />
      <Field name="password" label="Kata sandi" type="password" required minLength={8} maxLength={200} autoComplete="new-password" hint="Minimal 8 karakter, memuat huruf dan angka." />
      <Field name="confirmPassword" label="Ulangi kata sandi" type="password" required minLength={8} maxLength={200} autoComplete="new-password" />
      <SubmitButton size="lg" className="mt-2 w-full" pendingText="Mendaftarkan…">Buat akun</SubmitButton>
    </div>
  );
}

export function RegisterForm() {
  return (
    <>
      <ActionForm action={registerAction} successToast={false}><Fields /></ActionForm>
      <p className="mt-6 text-center text-sm text-muted">Sudah punya akun? <Link href="/login" className="font-semibold text-primary hover:underline">Masuk</Link></p>
    </>
  );
}
