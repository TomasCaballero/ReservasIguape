import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// La sesión se fuerza a UTC: el adaptador de pg lee y escribe los timestamptz sin
// offset, así que si el servidor usa otra zona (ej. Buenos Aires) los instantes
// (soft locks, plazos en horas) se corren. Las fechas de estadía son `date` y no se afectan.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      options: "-c timezone=UTC",
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
