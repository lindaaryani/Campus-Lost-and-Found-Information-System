import type { Metadata } from "next";
import { MasterPage } from "@/components/shared/master-page";

export const metadata: Metadata = { title: "Kategori Barang" };
export default function Page() { return <MasterPage kind="category" />; }
