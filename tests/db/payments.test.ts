import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPayment, MAX_RECEIPT_BYTES, type PaymentInput } from "@/lib/admin/payments";
import { prisma } from "@/lib/prisma";
import { localReceiptStorage } from "@/lib/storage/receipts";
import { createFixture } from "./helpers";

const fx = createFixture();
let dir: string;
let storage: ReturnType<typeof localReceiptStorage>;
let bookingId: string;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const file = (name: string, size: number, signature: number[]) => {
  const bytes = Buffer.alloc(size);
  Buffer.from(signature).copy(bytes);
  return { name, size, bytes };
};

const base = (extra: Partial<PaymentInput> = {}): PaymentInput => ({
  bookingId,
  amount: "50000",
  currency: "ARS",
  method: "Transferencia",
  reference: "TRF-123456",
  file: null,
  ...extra,
});

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "receipts-"));
  storage = localReceiptStorage(dir);
  const cat = await fx.category("cobros", 4, 1);
  bookingId = (await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "PENDING")).id;
  await prisma.booking.update({ where: { id: bookingId }, data: { total: 170000, currency: "ARS" } });
});

afterAll(async () => {
  await fx.cleanup();
  await rm(dir, { recursive: true, force: true });
  await prisma.$disconnect();
});

const count = () => prisma.payment.count({ where: { bookingId } });

describe("cobros manuales (RF-55)", () => {
  it("registra una seña con monto, moneda, método y referencia (AC-82)", async () => {
    const result = await createPayment(prisma, storage, base());
    if (!result.ok) throw new Error(JSON.stringify(result));
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(Number(payment.amount)).toBe(50000);
    expect(payment).toMatchObject({ currency: "ARS", method: "Transferencia", reference: "TRF-123456", receiptPath: null });
  });

  it("acepta un PNG de 3 MB sin referencia y deja el archivo recuperable (AC-83)", async () => {
    const png = file("comprobante.png", 3 * 1024 * 1024, PNG);
    const result = await createPayment(prisma, storage, base({ reference: "", file: png }));
    if (!result.ok) throw new Error(JSON.stringify(result));
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.reference).toBeNull();
    expect(payment.receiptPath).toMatch(/\.png$/);
    expect(payment.receiptUploadedAt).not.toBeNull();
    expect((await storage.read(payment.receiptPath!)).equals(png.bytes)).toBe(true);
  });

  it("sin referencia y sin archivo se rechaza con el mensaje esperado (AC-84)", async () => {
    const before = await count();
    const result = await createPayment(prisma, storage, base({ reference: "  " }));
    expect(result).toEqual({ ok: false, status: 400, errors: { reference: "Cargá una referencia o un archivo" } });
    expect(await count()).toBe(before);
  });

  it("rechaza un .exe y un PDF de 10 MB + 1 byte, y acepta uno de exactamente 10 MB (AC-85)", async () => {
    const before = await count();
    const exe = await createPayment(prisma, storage, base({ file: file("virus.exe", 100, [0x4d, 0x5a]) }));
    expect(exe).toMatchObject({ ok: false, status: 400 });
    const big = await createPayment(prisma, storage, base({ file: file("a.pdf", MAX_RECEIPT_BYTES + 1, PDF) }));
    expect(big).toMatchObject({ ok: false, errors: { file: "El archivo supera los 10 MB" } });
    expect(await count()).toBe(before);

    const exact = await createPayment(prisma, storage, base({ file: file("a.pdf", MAX_RECEIPT_BYTES, PDF) }));
    expect(exact.ok).toBe(true);
  });

  it("un cobro en USD en una reserva en ARS queda en USD, sin conversión (AC-86)", async () => {
    const result = await createPayment(prisma, storage, base({ amount: "50", currency: "USD" }));
    if (!result.ok) throw new Error(JSON.stringify(result));
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.currency).toBe("USD");
    expect(Number(payment.amount)).toBe(50);
  });

  it("valida monto, moneda y método, y no guarda nada si algo falla", async () => {
    const before = await count();
    const result = await createPayment(prisma, storage, base({ amount: "0", currency: "EUR", method: "Trueque" }));
    if (result.ok) throw new Error("debía fallar");
    expect(Object.keys("errors" in result ? result.errors : {}).sort()).toEqual(["amount", "currency", "method"]);
    expect(await count()).toBe(before);
  });

  it("una reserva inexistente responde 404", async () => {
    const result = await createPayment(prisma, storage, base({ bookingId: "00000000-0000-0000-0000-000000000000" }));
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("almacenamiento local de comprobantes", () => {
  it("rechaza claves que no sean un UUID con extensión permitida (sin recorrido de rutas)", async () => {
    for (const key of ["../../.env", "a.pdf", "..\\x.png", "00000000-0000-0000-0000-000000000000.exe"]) {
      await expect(storage.read(key), key).rejects.toThrow("Clave de comprobante inválida");
    }
  });
});
