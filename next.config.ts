import type { NextConfig } from "next";

/**
 * Catatan arsitektur:
 * - `cacheComponents` / `partialPrefetching` (default scaffold Next 16) sengaja DINONAKTIFKAN.
 *   CampusFind hampir seluruhnya berbasis sesi per-pengguna (data dinamis), sehingga
 *   Cache Components hanya menambah beban (Suspense wajib di mana-mana) tanpa manfaat.
 * - Batas body Server Actions dinaikkan agar upload foto (<= 3 MB) dan bukti klaim (<= 5 MB) muat.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "mysql2"],
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
