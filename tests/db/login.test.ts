import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attemptLogin } from "@/lib/auth/login";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const tag = `t${randomUUID().slice(0, 8)}`;
const PASSWORD = "clave-correcta-123";
const email = (n: string) => `${tag}-${n}@test.local`;
const ip = (n: string) => `${tag}-ip-${n}`;

const login = (e: string, address: string, password = PASSWORD) =>
  attemptLogin(prisma, { email: e, password, ip: address });
const bad = (e: string, address: string) => login(e, address, "incorrecta");

/** Simula que pasaron 15 minutos: vence el bloqueo de las claves de este test. */
const expireLocks = () =>
  prisma.$executeRaw`
    UPDATE "LoginThrottle" SET "lockedUntil" = now() - interval '1 second'
    WHERE "key" LIKE ${`${tag}%`} AND "lockedUntil" IS NOT NULL`;

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  for (const n of ["a", "b", "c", "d", "e", "f", "g"]) {
    await prisma.admin.create({ data: { email: email(n), passwordHash } });
  }
});

afterAll(async () => {
  await prisma.loginThrottle.deleteMany({ where: { key: { startsWith: tag } } });
  await prisma.admin.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("login (RF-31)", () => {
  it("con la contraseña correcta devuelve el admin (AC-45)", async () => {
    const result = await login(email("a"), ip("a"));
    expect(result.ok).toBe(true);
  });

  it("no distingue mayúsculas en el email", async () => {
    expect((await login(email("a").toUpperCase(), ip("a"))).ok).toBe(true);
  });

  it("con contraseña incorrecta rechaza (AC-46)", async () => {
    expect(await bad(email("a"), ip("a"))).toEqual({ ok: false, reason: "INVALID" });
  });

  it("un email inexistente se rechaza igual, sin revelar que no existe", async () => {
    expect(await login(email("no-existe"), ip("a"))).toEqual({ ok: false, reason: "INVALID" });
  });
});

describe("bloqueo por email (RF-32, AC-47)", () => {
  it("3 fallos con un email bloquean aunque el 4.º llegue desde otra IP con la clave correcta", async () => {
    for (const n of ["1", "2", "3"]) {
      expect(await bad(email("b"), ip(`b${n}`))).toEqual({ ok: false, reason: "INVALID" });
    }
    expect(await login(email("b"), ip("otra"))).toEqual({ ok: false, reason: "LOCKED" });
  });

  it("pasados los 15 minutos el login correcto funciona", async () => {
    await expireLocks();
    expect((await login(email("b"), ip("otra"))).ok).toBe(true);
  });
});

describe("bloqueo por IP (RF-32, AC-48)", () => {
  it("3 fallos desde una IP con emails distintos bloquean el login correcto de otro email", async () => {
    for (const n of ["c", "d", "e"]) {
      expect(await bad(email(n), ip("blocked"))).toEqual({ ok: false, reason: "INVALID" });
    }
    expect(await login(email("f"), ip("blocked"))).toEqual({ ok: false, reason: "LOCKED" });
  });

  it("otra IP no está bloqueada, y al vencer el bloqueo la IP vuelve a funcionar", async () => {
    expect((await login(email("f"), ip("libre"))).ok).toBe(true);
    await expireLocks();
    expect((await login(email("f"), ip("blocked"))).ok).toBe(true);
  });
});

describe("contador de intentos", () => {
  it("un login correcto reinicia el contador del email", async () => {
    await bad(email("g"), ip("g1"));
    await bad(email("g"), ip("g2"));
    expect((await login(email("g"), ip("g3"))).ok).toBe(true);
    // Si no se hubiera reiniciado, este fallo sería el 4.º y quedaría bloqueado.
    expect(await bad(email("g"), ip("g4"))).toEqual({ ok: false, reason: "INVALID" });
    expect(await bad(email("g"), ip("g5"))).toEqual({ ok: false, reason: "INVALID" });
  });

  it("intentos en paralelo no superan el máximo: solo 3 llegan a verificarse", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => bad(email("par"), ip(`par${i}`))),
    );
    expect(results.filter((r) => !r.ok && r.reason === "INVALID")).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.reason === "LOCKED")).toHaveLength(7);
  });
});
