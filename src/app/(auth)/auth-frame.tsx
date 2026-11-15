import { Brand } from "@/components/shared/brand";
import { ToastProvider } from "@/components/shared/toast";

const STEPS = [
  ["Laporkan", "Catat barang hilang atau temuan lengkap dengan ciri-cirinya."],
  ["Cocokkan", "Sistem menyarankan laporan yang mirip. Skornya hanya rekomendasi."],
  ["Klaim", "Ajukan klaim dengan bukti; admin kampus yang memverifikasi."],
];

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="relative hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
          <div className="tri-stripe absolute inset-x-0 top-0" />
          <Brand tone="light" />
          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight text-white">Temukan kembali barang yang hilang di kampus.</h1>
            <p className="mt-4 text-white/75">Lost &amp; Found resmi untuk mahasiswa, dosen, dan staf ITB STIKOM Bali.</p>
            <ol className="mt-10 space-y-5">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12 text-sm font-bold">{i + 1}</span>
                  <div><p className="font-semibold">{t}</p><p className="text-sm text-white/70">{d}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-white/50">Perancangan dan Implementasi Sistem Informasi Lost &amp; Found Campus dengan Algoritma Pencocokan Barang.</p>
        </aside>
        <main className="flex flex-col justify-center px-5 py-10 sm:px-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden"><Brand /></div>
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
