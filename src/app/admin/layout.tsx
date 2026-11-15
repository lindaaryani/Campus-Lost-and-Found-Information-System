import { AppShell } from "@/components/shared/app-shell";
import { requireAdmin } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AppShell user={admin}>{children}</AppShell>;
}
