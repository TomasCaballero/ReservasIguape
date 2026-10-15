// Resetea la contraseña del admin: toma ADMIN_EMAIL y ADMIN_PASSWORD del .env,
// la guarda como Argon2id y levanta los bloqueos de login. Uso:
//   1) editar ADMIN_PASSWORD en .env  2) npm run admin:reset-password
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { hashPassword } from "../lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Faltan ADMIN_EMAIL / ADMIN_PASSWORD en .env");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: "-c timezone=UTC" }),
  });
  try {
    const passwordHash = await hashPassword(password);
    const existing = await prisma.admin.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existing) {
      await prisma.admin.update({ where: { id: existing.id }, data: { passwordHash } });
    } else {
      await prisma.admin.create({ data: { email, passwordHash } });
    }
    await prisma.loginThrottle.deleteMany();
    console.log(existing ? "Contraseña actualizada." : "Admin creado.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
