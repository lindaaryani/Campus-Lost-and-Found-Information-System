import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary-50 text-primary"><SearchX className="size-7" /></div>
        <h1 className="text-xl font-bold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted">Laporan atau halaman yang Anda cari tidak ada, sudah dihapus, atau tidak dapat Anda akses.</p>
        <Button asChild className="mt-6"><Link href="/">Kembali ke beranda</Link></Button>
      </div>
    </main>
  );
}
