export type NavItem = { href: string; label: string; icon: string; exact?: boolean; badge?: "notifications" | "claims" };

export const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layout", exact: true },
  { href: "/barang-hilang", label: "Barang Hilang", icon: "searchx" },
  { href: "/barang-ditemukan", label: "Barang Ditemukan", icon: "package" },
  { href: "/cari", label: "Cari Barang", icon: "search" },
  { href: "/laporan-saya", label: "Laporan Saya", icon: "clipboard" },
  { href: "/rekomendasi", label: "Rekomendasi", icon: "sparkles" },
  { href: "/klaim", label: "Klaim Saya", icon: "filecheck" },
  { href: "/notifikasi", label: "Notifikasi", icon: "bell", badge: "notifications" },
  { href: "/profil", label: "Profil", icon: "user" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "layout", exact: true },
  { href: "/admin/klaim", label: "Verifikasi Klaim", icon: "shield", badge: "claims" },
  { href: "/admin/laporan", label: "Laporan", icon: "clipboard" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "users" },
  { href: "/admin/kategori", label: "Kategori", icon: "tags" },
  { href: "/admin/lokasi", label: "Lokasi", icon: "mappin" },
  { href: "/admin/statistik", label: "Statistik", icon: "chart" },
  { href: "/admin/log", label: "Log Aktivitas", icon: "history" },
];
