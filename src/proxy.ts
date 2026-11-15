import { NextResponse, type NextRequest } from "next/server";

/**
 * Lapisan pertama (murah): belum ada cookie sesi => alihkan ke /login sebelum halaman dirender.
 * INI BUKAN otorisasi. Keabsahan sesi, role, dan status akun SELALU diperiksa ulang di server
 * (requireUser/requireAdmin, assertUser/assertAdmin, dan route handler berkas).
 */
export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.has("cf_session");
  if (!hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/barang-hilang/:path*", "/barang-ditemukan/:path*", "/cari/:path*", "/laporan/:path*",
    "/laporan-saya/:path*", "/barang/:path*", "/rekomendasi/:path*", "/klaim/:path*", "/notifikasi/:path*",
    "/profil/:path*", "/admin/:path*",
  ],
};
