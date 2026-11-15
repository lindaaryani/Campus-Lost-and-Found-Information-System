import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { config } from "@/lib/config";
import { Alert } from "@/components/shared/ui-bits";
import { AuthFrame } from "../auth-frame";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage() {
  const u = await getCurrentUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/dashboard");
  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold">Buat akun CampusFind</h2>
      <p className="mb-8 mt-1.5 text-sm text-muted">Untuk mahasiswa, dosen, dan staf ITB STIKOM Bali.</p>
      {config.allowSelfRegistration ? (
        <RegisterForm />
      ) : (
        <Alert tone="warning" title="Pendaftaran mandiri sedang ditutup">
          Hubungi administrator kampus untuk dibuatkan akun. <Link href="/login" className="font-semibold underline">Kembali ke halaman masuk</Link>
        </Alert>
      )}
    </AuthFrame>
  );
}
