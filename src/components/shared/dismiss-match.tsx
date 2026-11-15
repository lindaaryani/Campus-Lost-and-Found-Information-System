"use client";
import { ActionDialog } from "./action-dialog";
import { dismissMatchAction } from "@/app/(user)/actions";

export function DismissMatchButton({ matchId }: { matchId: number }) {
  return (
    <ActionDialog
      trigger="Abaikan" triggerVariant="ghost" title="Abaikan rekomendasi ini?"
      description="Rekomendasi tidak akan ditampilkan lagi. Laporan Anda dan laporan lawan tidak berubah."
      submitLabel="Ya, abaikan" action={dismissMatchAction} hidden={{ matchId }}
    />
  );
}
