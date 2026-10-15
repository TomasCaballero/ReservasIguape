import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, signSession, verifySession } from "@/lib/auth/session";

const SECRET = "x".repeat(40);
let original: string | undefined;

beforeEach(() => {
  original = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = SECRET;
});
afterEach(() => {
  process.env.SESSION_SECRET = original;
});

describe("sesión firmada (RF-31)", () => {
  it("un token recién firmado se verifica y devuelve el id del admin", () => {
    const token = signSession("admin-1");
    expect(verifySession(token)).toEqual({ adminId: "admin-1" });
  });

  it("vence a las 8 horas", () => {
    const now = Date.now();
    const token = signSession("admin-1", now);
    expect(verifySession(token, now + (SESSION_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifySession(token, now + SESSION_TTL_SECONDS * 1000)).toBeNull();
  });

  it("rechaza tokens alterados, con otra firma o con otro secreto", () => {
    const token = signSession("admin-1");
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "otro-admin", exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");

    expect(verifySession(`${forged}.${signature}`)).toBeNull();
    expect(verifySession(`${payload}.${signature}x`)).toBeNull();
    process.env.SESSION_SECRET = "y".repeat(40);
    expect(verifySession(token)).toBeNull();
  });

  it("rechaza valores vacíos o mal formados", () => {
    for (const bad of [undefined, "", "abc", "a.b.c", ".", "a."]) {
      expect(verifySession(bad), String(bad)).toBeNull();
    }
  });

  it("exige un SESSION_SECRET de al menos 32 caracteres", () => {
    process.env.SESSION_SECRET = "corto";
    expect(() => signSession("admin-1")).toThrow(/SESSION_SECRET/);
  });
});
