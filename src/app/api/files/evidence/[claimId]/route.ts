import { getCurrentUser } from "@/lib/session";
import { readStored } from "@/lib/uploads";
import { getEvidenceKeyFor } from "@/modules/claims/service";

/** Bukti klaim: HANYA pengaju klaim atau ADMIN (FR-33, NFR-03). Selain itu 404 agar keberadaan berkas tidak bocor. */
export async function GET(_req: Request, ctx: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Tidak diizinkan", { status: 401 });
  if (!/^\d{1,18}$/.test(claimId)) return new Response("Tidak ditemukan", { status: 404 });

  const key = await getEvidenceKeyFor(user, Number(claimId));
  if (!key) return new Response("Tidak ditemukan", { status: 404 });
  const file = await readStored(key);
  if (!file) return new Response("Tidak ditemukan", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="bukti-klaim-${claimId}.${file.mime === "application/pdf" ? "pdf" : file.mime.split("/")[1]}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
