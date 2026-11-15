import type { Metadata } from "next";
import { requireUser } from "@/lib/authz";
import { config } from "@/lib/config";
import { todayLocal } from "@/lib/utils";
import { getMasterOptions } from "@/modules/items/service";
import { createItemAction } from "../../../actions";
import { ItemForm } from "@/components/shared/item-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/ui-bits";

export const metadata: Metadata = { title: "Lapor Kehilangan" };

export default async function Page() {
  await requireUser();
  const { categories, locations } = await getMasterOptions();
  return (
    <>
      <PageHeader title="Lapor Kehilangan" description="Semakin lengkap ciri barang, semakin besar peluang sistem menemukan laporan temuan yang cocok." />
      <Card className="max-w-3xl"><CardBody>
        <ItemForm type="LOST" action={createItemAction} categories={categories} locations={locations} today={todayLocal()}
          maxPhotoMB={config.maxPhotoBytes / 1048576} submitLabel="Kirim laporan kehilangan" cancelHref="/barang-hilang" />
      </CardBody></Card>
    </>
  );
}
