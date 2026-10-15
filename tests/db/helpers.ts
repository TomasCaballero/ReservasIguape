import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Crea datos aislados (prefijo único por corrida) y los borra al final. */
export function createFixture() {
  const tag = `t${randomUUID().slice(0, 8)}`;
  const categoryIds: string[] = [];
  const customerIds: string[] = [];
  const documents: string[] = [];

  return {
    tag,

    async category(name: string, maxCapacity: number, units: number) {
      const category = await prisma.category.create({
        data: {
          slug: `${tag}-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name: `${tag} ${name}`,
          description: "fixture",
          maxCapacity,
          basePriceArs: 40000,
          basePriceUsd: 40,
        },
      });
      categoryIds.push(category.id);
      const unitIds: string[] = [];
      for (let i = 0; i < units; i++) {
        const unit = await prisma.unit.create({
          data: {
            name: `${tag} u${i}`,
            categoryId: category.id,
            icalToken: randomUUID().replace(/-/g, ""),
          },
        });
        unitIds.push(unit.id);
      }
      return { id: category.id, unitIds };
    },

    /** Reserva activa que ocupa una unidad (escribe también la fila de ocupación). */
    async booking(
      category: { id: string },
      unitId: string,
      checkIn: string,
      checkOut: string,
      status: "PENDING" | "CONFIRMED" = "CONFIRMED",
    ) {
      const customer = await prisma.customer.create({
        data: {
          documentType: "DNI",
          documentNumber: `${tag}-${randomUUID().slice(0, 6)}`,
          firstName: "Test",
          lastName: "Fixture",
          email: "fixture@example.com",
          phone: "+54 1100000000",
          birthDate: new Date("1990-01-01"),
        },
      });
      customerIds.push(customer.id);
      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          categoryId: category.id,
          categoryName: "fixture",
          unitId,
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: 2,
          status,
          currency: "ARS",
          subtotal: 0,
          total: 0,
        },
      });
      await prisma.unitOccupancy.create({
        data: {
          unitId,
          startDate: new Date(checkIn),
          endDate: new Date(checkOut),
          bookingId: booking.id,
        },
      });
      return booking;
    },

    /** Soft lock con vencimiento explícito, para fijar T + 15 min. */
    async softLock(
      category: { id: string },
      unitId: string,
      checkIn: string,
      checkOut: string,
      expiresAt: Date,
    ) {
      const lock = await prisma.softLock.create({
        data: {
          categoryId: category.id,
          unitId,
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          token: randomUUID(),
          expiresAt,
        },
      });
      await prisma.unitOccupancy.create({
        data: {
          unitId,
          startDate: new Date(checkIn),
          endDate: new Date(checkOut),
          softLockId: lock.id,
        },
      });
      return lock;
    },

    async block(unitId: string, startDate: string, endDate: string) {
      const block = await prisma.unitBlock.create({
        data: {
          unitId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          kind: "MAINTENANCE",
        },
      });
      await prisma.unitOccupancy.create({
        data: {
          unitId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          blockId: block.id,
        },
      });
    },

    /** Titular válido con un DNI único (queda registrado para limpiarlo al final). */
    holder(overrides: Record<string, string> = {}) {
      const documentNumber = `98${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, "0")}`;
      documents.push(documentNumber);
      return {
        firstName: "Juan",
        lastName: "Pérez",
        email: "juan@mail.com",
        phonePrefix: "+54",
        phoneNumber: "1155551234",
        documentType: "DNI" as const,
        documentNumber,
        birthDate: "1990-05-20",
        ...overrides,
      };
    },

    async cleanup() {
      const docCustomers = await prisma.customer.findMany({
        where: { documentNumber: { in: documents } },
        select: { id: true },
      });
      const allCustomers = [...customerIds, ...docCustomers.map((c) => c.id)];
      await prisma.booking.deleteMany({ where: { customerId: { in: allCustomers } } });
      await prisma.customer.deleteMany({ where: { id: { in: allCustomers } } });
      await prisma.unit.deleteMany({ where: { categoryId: { in: categoryIds } } });
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    },
  };
}
