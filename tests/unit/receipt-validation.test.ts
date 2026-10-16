import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_BYTES, validateReceiptFile, type ReceiptFile } from "@/lib/admin/payments";

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff, 0xe0];

/** Archivo de `size` bytes que empieza con la firma indicada. */
const file = (name: string, size: number, signature: number[]): ReceiptFile => {
  const bytes = Buffer.alloc(size);
  Buffer.from(signature).copy(bytes);
  return { name, size, bytes };
};

describe("comprobante (RF-55)", () => {
  it("acepta PDF, JPG, JPEG y PNG sin importar mayúsculas", () => {
    expect(validateReceiptFile(file("a.pdf", 100, PDF))).toEqual({ ok: true, extension: "pdf" });
    expect(validateReceiptFile(file("a.PNG", 100, PNG))).toEqual({ ok: true, extension: "png" });
    expect(validateReceiptFile(file("a.jpg", 100, JPG))).toEqual({ ok: true, extension: "jpg" });
    expect(validateReceiptFile(file("foto.JPEG", 100, JPG))).toEqual({ ok: true, extension: "jpg" });
  });

  it("rechaza otros tipos, como un .exe (AC-85)", () => {
    expect(validateReceiptFile(file("virus.exe", 100, [0x4d, 0x5a]))).toMatchObject({ ok: false });
    expect(validateReceiptFile(file("sin-extension", 100, PDF))).toMatchObject({ ok: false });
    expect(validateReceiptFile(file("doc.pdf.exe", 100, PDF))).toMatchObject({ ok: false });
  });

  it("acepta exactamente 10 MB y rechaza un byte más (AC-85)", () => {
    expect(MAX_RECEIPT_BYTES).toBe(10_485_760);
    expect(validateReceiptFile(file("a.pdf", MAX_RECEIPT_BYTES, PDF))).toEqual({ ok: true, extension: "pdf" });
    expect(validateReceiptFile(file("a.pdf", MAX_RECEIPT_BYTES + 1, PDF))).toEqual({
      ok: false,
      message: "El archivo supera los 10 MB",
    });
  });

  it("rechaza archivos cuyo contenido no coincide con la extensión", () => {
    expect(validateReceiptFile(file("falso.pdf", 100, [0x4d, 0x5a, 0x90]))).toMatchObject({ ok: false });
    expect(validateReceiptFile(file("falso.png", 100, PDF))).toMatchObject({ ok: false });
  });

  it("rechaza archivos vacíos", () => {
    expect(validateReceiptFile({ name: "a.pdf", size: 0, bytes: Buffer.alloc(0) })).toEqual({
      ok: false,
      message: "El archivo está vacío",
    });
  });
});
