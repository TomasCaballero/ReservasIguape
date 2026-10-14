import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password (RNF-05, AC-105)", () => {
  it("guarda un hash argon2id con m>=19456 y t>=2, sin la contraseña en claro", async () => {
    const hash = await hashPassword("clave-secreta-123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("clave-secreta-123");
    const m = /m=(\d+)/.exec(hash)?.[1];
    const t = /t=(\d+)/.exec(hash)?.[1];
    expect(Number(m)).toBeGreaterThanOrEqual(19456);
    expect(Number(t)).toBeGreaterThanOrEqual(2);
  });

  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashPassword("clave-secreta-123");
    expect(await verifyPassword(hash, "clave-secreta-123")).toBe(true);
    expect(await verifyPassword(hash, "otra")).toBe(false);
  });
});
