import type { Metadata } from "next";
import { requireUser } from "@/lib/authz";
import { config } from "@/lib/config";
import { todayLocal } from "@/lib/utils";
import { getMasterOptions } from "@/modules/items/service";
import { createItemAction } from "../../../actions";
import { ItemForm } from "@/components/shared/item-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/ui-bits";

export const metadata: Metadata = { title: "Lapor Temuan" };

export default async function Page() {
  await requireUser();
  const { categories, locations } = await getMasterOptions();
  return (
    <>
      <PageHeader title="Lapor Temuan" description="Terima kasih sudah melaporkan. Simpan barang di tempat aman sampai admin memverifikasi klaim pemiliknya." />
      <Card className="max-w-3xl"><CardBody>
        <ItemForm type="FOUND" action={createItemAction} categories={categories} locations={locations} today={todayLocal()}
          maxPhotoMB={config.maxPhotoBytes / 1048576} submitLabel="Kirim laporan temuan" cancelHref="/barang-ditemukan" />
      </CardBody></Card>
    </>
  );
}
