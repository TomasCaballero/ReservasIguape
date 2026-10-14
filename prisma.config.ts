import "dotenv/config";
import { defineConfig } from "prisma/config";

// El CLI (migrate, db seed) usa DIRECT_URL (conexión directa a Supabase);
// la app en runtime usará DATABASE_URL (pooler).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
