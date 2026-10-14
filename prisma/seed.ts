// Datos de DESARROLLO: catálogo de ejemplo del PRD (6 categorías, 20 unidades)
// y el primer admin (ADMIN_EMAIL / ADMIN_PASSWORD). Idempotente.
// Los precios, capacidades y cantidades salvo De Luxe son inventados.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { hashPassword } from "../lib/password";

const CATALOG = [
  { slug: "de-luxe", name: "De Luxe", maxCapacity: 5, ars: 40000, usd: 40, units: 4 },
  { slug: "premium", name: "Premium", maxCapacity: 5, ars: 45000, usd: 45, units: 4 },
  { slug: "superior", name: "Superior", maxCapacity: 4, ars: 35000, usd: 35, units: 4 },
  { slug: "loft", name: "Loft", maxCapacity: 2, ars: 30000, usd: 30, units: 3 },
  { slug: "king-suite", name: "King Suite", maxCapacity: 2, ars: 55000, usd: 55, units: 3 },
  { slug: "classic", name: "Classic", maxCapacity: 2, ars: 25000, usd: 25, units: 2 },
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Faltan ADMIN_EMAIL / ADMIN_PASSWORD en .env");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await prisma.admin.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: await hashPassword(password) },
    });

    let unitNumber = (await prisma.unit.count()) + 1;
    for (const c of CATALOG) {
      const category = await prisma.category.upsert({
        where: { slug: c.slug },
        update: {},
        create: {
          slug: c.slug,
          name: c.name,
          description: `Apart ${c.name} (datos de ejemplo)`,
          maxCapacity: c.maxCapacity,
          basePriceArs: c.ars,
          basePriceUsd: c.usd,
        },
      });
      const existing = await prisma.unit.count({ where: { categoryId: category.id } });
      for (let i = existing; i < c.units; i++) {
        await prisma.unit.create({
          data: {
            name: `Apart ${unitNumber}`,
            categoryId: category.id,
            icalToken: randomBytes(16).toString("hex"), // 128 bits (RNF-06)
          },
        });
        unitNumber++;
      }
    }
    console.log(
      `seed ok: ${await prisma.category.count()} categorías, ${await prisma.unit.count()} unidades, ${await prisma.admin.count()} admin(s)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
