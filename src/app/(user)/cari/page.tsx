import type { Metadata } from "next";
import { requireUser } from "@/lib/authz";
import { PageHeader } from "@/components/shared/ui-bits";
import { ItemListPage } from "@/components/shared/item-list-page";

export const metadata: Metadata = { title: "Cari Barang" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Cari Barang" description="Telusuri semua laporan hilang dan ditemukan berdasarkan kata kunci, kategori, lokasi, atau tanggal." />
      <ItemListPage user={user} basePath="/cari" searchParams={await searchParams} showType />
    </>
  );
}
