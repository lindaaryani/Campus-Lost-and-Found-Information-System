"use client";
import * as React from "react";
import Link from "next/link";
import { GraduationCap, Presentation, ShieldCheck, Briefcase } from "lucide-react";
import { ActionForm, Field, SubmitButton, useFormState } from "@/components/shared/forms";
import { IDENTITY_OPTIONS, IDENTITY_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { IdentityType, UserType } from "@/lib/types";
import { loginAction } from "../actions";

type Mode = "STUDENT" | "LECTURER" | "STAFF" | "ADMIN";
const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "STUDENT", label: "Mahasiswa", icon: GraduationCap },
  { id: "LECTURER", label: "Dosen", icon: Presentation },
  { id: "STAFF", label: "Staf", icon: Briefcase },
  { id: "ADMIN", label: "Admin", icon: ShieldCheck },
];

function Fields({ allowRegistration }: { allowRegistration: boolean }) {
  const state = useFormState();
  const [mode, setMode] = React.useState<Mode>((state?.values?.userType as UserType) ?? (state?.values?.accountType === "ADMIN" ? "ADMIN" : "STUDENT"));
  const isAdmin = mode === "ADMIN";
  const idOptions = !isAdmin ? IDENTITY_OPTIONS[mode as UserType] : [];
  const [idType, setIdType] = React.useState<IdentityType>(idOptions[0] ?? "NIM");
  const effectiveType = idOptions.includes(idType) ? idType : idOptions[0];

  return (
    <>
      <input type="hidden" name="accountType" value={isAdmin ? "ADMIN" : "USER"} />
      {!isAdmin && <input type="hidden" name="userType" value={mode} />}
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-semibold">Masuk sebagai</legend>
        <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-slate-100 p-1">
          {MODES.map((m) => (
            <label key={m.id} className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-2 text-xs font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-azure",
              mode === m.id ? "bg-surface text-primary shadow-card" : "text-muted hover:text-ink")}>
              <input type="radio" name="_mode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="sr-only" />
              <m.icon className="size-4" />{m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4">
        {isAdmin ? (
          <Field name="username" label="Username admin" required autoComplete="username" maxLength={60} />
        ) : (
          <>
            {idOptions.length > 1 && (
              <Field name="identityType" label="Jenis identitas" as="select" required value={effectiveType} onChange={(e) => setIdType(e.target.value as IdentityType)}
                options={idOptions.map((o) => ({ value: o, label: IDENTITY_TYPE_LABEL[o] }))} />
            )}
            {idOptions.length === 1 && <input type="hidden" name="identityType" value={idOptions[0]} />}
            <Field
              name="identityNumber" label={`Nomor ${IDENTITY_TYPE_LABEL[effectiveType ?? "NIM"]}`} required autoComplete="username"
              inputMode={effectiveType === "NIM" ? "numeric" : "text"} maxLength={40} minLength={4}
              placeholder={effectiveType === "NIM" ? "Contoh: 240030123" : undefined}
            />
          </>
        )}
        <Field name="password" label="Kata sandi" type="password" required autoComplete="current-password" maxLength={200} />
      </div>
      <SubmitButton size="lg" className="mt-6 w-full" pendingText="Memeriksa…">Masuk</SubmitButton>
      {!isAdmin && allowRegistration && (
        <p className="mt-6 text-center text-sm text-muted">Belum punya akun? <Link href="/register" className="font-semibold text-primary hover:underline">Daftar sekarang</Link></p>
      )}
      {isAdmin && <p className="mt-6 text-center text-xs text-muted">Akun admin dibuat oleh pengelola sistem dan tidak dapat didaftarkan sendiri.</p>}
    </>
  );
}

export function LoginForm({ allowRegistration }: { allowRegistration: boolean }) {
  return (
    <ActionForm action={loginAction} successToast={false}>
      <Fields allowRegistration={allowRegistration} />
    </ActionForm>
  );
}
