import type { PrismaClient } from "@/app/generated/prisma/client";
import type { MutationResult } from "./catalog";
import type { IcalSourceValue } from "./validation";

// Alta y baja de las URLs iCal que se importan por unidad (RF-64).

type Db = PrismaClient;

export async function addIcalSource(db: Db, value: IcalSourceValue): Promise<MutationResult> {
  const unit = await db.unit.findUnique({ where: { id: value.unitId }, select: { id: true } });
  if (!unit) return { ok: false, errors: { unitId: "La unidad no existe" } };
  await db.icalSource.create({ data: value });
  return { ok: true };
}

/** Borra la fuente y, en cascada, los bloqueos que había importado: liberan sus fechas. */
export async function removeIcalSource(db: Db, id: string): Promise<MutationResult> {
  const result = await db.icalSource.deleteMany({ where: { id } });
  if (result.count === 0) return { ok: false, errors: { _form: "La fuente no existe" } };
  return { ok: true };
}
