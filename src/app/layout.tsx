import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CampusFind — Lost & Found Kampus", template: "%s · CampusFind" },
  description:
    "Sistem informasi Lost & Found ITB STIKOM Bali: laporkan barang hilang atau ditemukan, dapatkan rekomendasi kecocokan, dan ajukan klaim kepemilikan.",
};

export const viewport: Viewport = { themeColor: "#174A8B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
