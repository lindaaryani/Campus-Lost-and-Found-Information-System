"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** NFR-06: pesan galat informatif; detail teknis tidak ditampilkan ke pengguna (hanya `digest` untuk dilaporkan). */
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-[70vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-50 text-red-700"><AlertTriangle className="size-7" /></div>
        <h1 className="text-xl font-bold">Terjadi gangguan saat memproses halaman</h1>
        <p className="mt-2 text-sm text-muted">Data Anda aman. Silakan coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi administrator dan sebutkan kode di bawah.</p>
        {error.digest && <p className="mt-3 inline-block rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs text-muted">Kode: {error.digest}</p>}
        <div className="mt-6"><Button onClick={reset}><RotateCcw />Coba lagi</Button></div>
      </div>
    </main>
  );
}
