import type { Metadata } from "next";
import { requireUser } from "@/lib/authz";
import { PageHeader } from "@/components/shared/ui-bits";
import { ItemListPage } from "@/components/shared/item-list-page";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";

export const metadata: Metadata = { title: "Barang Hilang" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Barang Hilang" description="Laporan kehilangan dari civitas kampus. Kenali barang yang Anda temukan? Buat laporan temuan agar pemiliknya bisa dicocokkan."
        actions={<Button asChild><Link href="/laporan/hilang/baru"><FilePlus2 />Lapor Kehilangan</Link></Button>} />
      <ItemListPage user={user} basePath="/barang-hilang" searchParams={await searchParams} forceType="LOST" showType={false} />
    </>
  );
}
