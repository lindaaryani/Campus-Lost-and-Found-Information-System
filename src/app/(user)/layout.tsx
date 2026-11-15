import { AppShell } from "@/components/shared/app-shell";
import { requireUser } from "@/lib/authz";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
