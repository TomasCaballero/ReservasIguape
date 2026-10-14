import "dotenv/config";
import { defineConfig } from "prisma/config";

// El CLI (migrate, db seed) usa DIRECT_URL. En Postgres local es la misma
// URL que DATABASE_URL (la de runtime); en Supabase serán pooler vs directa.
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
