import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { config } from "@/lib/config";
import { AuthFrame } from "../auth-frame";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  const u = await getCurrentUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/dashboard");
  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold">Masuk ke CampusFind</h2>
      <p className="mb-8 mt-1.5 text-sm text-muted">Gunakan identitas kampus Anda: NIM, NIDN, NIP, atau ID pegawai.</p>
      <LoginForm allowRegistration={config.allowSelfRegistration} />
    </AuthFrame>
  );
}
