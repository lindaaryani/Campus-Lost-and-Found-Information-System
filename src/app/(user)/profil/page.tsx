import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { IDENTITY_TYPE_LABEL, USER_TYPE_LABEL } from "@/lib/labels";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/shared/ui-bits";
import { AccountStatusBadge } from "@/components/shared/badges";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil" };

export default async function Page() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Profil" description="Perbarui data kontak Anda. Identitas kampus dan tipe akun tidak dapat diubah sendiri." />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="size-4 text-muted" />Identitas kampus</CardTitle></CardHeader>
          <CardBody>
            <DefinitionList items={[
              { label: "Tipe akun", value: user.userType ? USER_TYPE_LABEL[user.userType] : "-" },
              { label: user.identityType ? IDENTITY_TYPE_LABEL[user.identityType] : "Identitas", value: user.identityNumber },
              { label: "Status akun", value: <AccountStatusBadge status={user.accountStatus} /> },
            ]} />
            <p className="mt-5 text-xs text-muted">Salah data? Hubungi administrator kampus agar identitas Anda dikoreksi.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Data kontak</CardTitle></CardHeader>
          <CardBody><ProfileForm fullName={user.fullName} email={user.email} phone={user.phoneNumber} /></CardBody>
        </Card>
      </div>
    </>
  );
}
