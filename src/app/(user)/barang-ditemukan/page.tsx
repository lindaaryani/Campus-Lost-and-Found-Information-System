import type { Metadata } from "next";
import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { PageHeader } from "@/components/shared/ui-bits";
import { ItemListPage } from "@/components/shared/item-list-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Barang Ditemukan" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Barang Ditemukan" description="Barang yang ditemukan dan dilaporkan di kampus. Merasa ini milik Anda? Buka laporannya lalu ajukan klaim dengan bukti."
        actions={<Button asChild><Link href="/laporan/ditemukan/baru"><PackagePlus />Lapor Temuan</Link></Button>} />
      <ItemListPage user={user} basePath="/barang-ditemukan" searchParams={await searchParams} forceType="FOUND" showType={false} />
    </>
  );
}
