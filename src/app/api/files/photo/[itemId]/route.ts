import { getCurrentUser } from "@/lib/session";
import { readStored } from "@/lib/uploads";
import { getPhotoKey } from "@/modules/items/service";

/** Foto laporan: hanya pengguna terautentikasi; laporan REJECTED/CLOSED hanya untuk pemilik & admin. */
export async function GET(_req: Request, ctx: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Tidak diizinkan", { status: 401 });
  if (!/^\d{1,18}$/.test(itemId)) return new Response("Tidak ditemukan", { status: 404 });

  const meta = await getPhotoKey(Number(itemId));
  if (!meta?.key) return new Response("Tidak ditemukan", { status: 404 });
  const visible = ["OPEN", "CLAIM_PENDING", "RETURNED"].includes(meta.status);
  if (!visible && user.role !== "ADMIN" && user.userId !== meta.ownerId) return new Response("Tidak ditemukan", { status: 404 });

  const file = await readStored(meta.key);
  if (!file) return new Response("Tidak ditemukan", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
