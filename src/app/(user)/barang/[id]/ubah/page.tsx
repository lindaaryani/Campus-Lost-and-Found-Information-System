import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { config } from "@/lib/config";
import { todayLocal } from "@/lib/utils";
import { getItemDetail, getMasterOptions } from "@/modules/items/service";
import { ItemForm } from "@/components/shared/item-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/ui-bits";
import { updateItemAction } from "../../../actions";

export const metadata: Metadata = { title: "Ubah Laporan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  const item = await getItemDetail(Number(id), user);
  if (!item || !item.isOwner) notFound();
  if (item.itemStatus !== "OPEN") redirect(`/barang/${id}`);
  const { categories, locations } = await getMasterOptions({ categoryId: item.categoryId, locationId: item.locationId });
  return (
    <>
      <PageHeader title="Ubah Laporan" description="Perubahan akan memicu pencocokan ulang dengan laporan lain." />
      <Card className="max-w-3xl"><CardBody>
        <ItemForm type={item.itemType} action={updateItemAction} categories={categories} locations={locations} today={todayLocal()}
          maxPhotoMB={config.maxPhotoBytes / 1048576} submitLabel="Simpan perubahan" cancelHref={`/barang/${id}`}
          edit={{ itemId: item.itemId, itemName: item.itemName, categoryId: item.categoryId, locationId: item.locationId, color: item.color,
            description: item.description, incidentDate: item.incidentDate, privateIdentifier: item.privateIdentifier, hasPhoto: item.hasPhoto }} />
      </CardBody></Card>
    </>
  );
}
