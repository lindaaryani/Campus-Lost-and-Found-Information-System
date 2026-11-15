import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { listMatchesForUser } from "@/modules/matching/service";
import { Alert, EmptyState, PageHeader } from "@/components/shared/ui-bits";
import { MatchList } from "@/components/shared/match-list";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Rekomendasi Kecocokan" };

export default async function Page() {
  const user = await requireUser();
  const matches = await listMatchesForUser(user.userId);
  return (
    <>
      <PageHeader title="Rekomendasi Kecocokan" description="Laporan lain yang mirip dengan laporan Anda, dihitung dengan Weighted Similarity Scoring (kategori, warna, lokasi, tanggal, deskripsi)." />
      <Alert tone="info" className="mb-6" title="Skor bukan bukti kepemilikan">
        Rekomendasi muncul bila kemiripan minimal {config.matchThreshold}%. Untuk mengambil barang, tetap diperlukan klaim yang diverifikasi admin.
      </Alert>
      {matches.length === 0 ? (
        <EmptyState icon={Sparkles} title="Belum ada rekomendasi"
          description="Rekomendasi muncul otomatis saat ada laporan lain yang cukup mirip dengan laporan Anda yang masih Terbuka."
          action={<Button asChild variant="secondary"><Link href="/laporan-saya">Lihat laporan saya</Link></Button>} />
      ) : <MatchList matches={matches} />}
    </>
  );
}
