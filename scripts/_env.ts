import dotenv from "dotenv";
import path from "node:path";

// Muat .env.local lalu .env (urutan sama dengan Next.js).
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export function scriptDbConfig() {
  return {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "campusfind",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "campusfind",
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
  } as const;
}
