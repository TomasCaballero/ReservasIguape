import type { PrismaClient } from "@/app/generated/prisma/client";
import type { FieldErrors } from "@/lib/booking/guest-validation";
import type { ReceiptStorage } from "@/lib/storage/receipts";
import { parseMoney } from "./validation";

// Cobros manuales (RF-55). Cada cobro queda en su propia moneda, sin conversión (AC-86).

export const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Tarjeta", "Depósito", "Otro"] as const;

/** 10 MB = 10.485.760 bytes (AC-85, supuesto del PRD): exactamente eso se acepta, un byte más no. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export type ReceiptExtension = "pdf" | "jpg" | "png";
export const RECEIPT_CONTENT_TYPE: Record<ReceiptExtension, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

export type ReceiptFile = { name: string; size: number; bytes: Buffer };

const EXTENSIONS: Record<string, ReceiptExtension> = { pdf: "pdf", jpg: "jpg", jpeg: "jpg", png: "png" };

const startsWith = (bytes: Buffer, signature: number[]) => signature.every((b, i) => bytes[i] === b);
const SIGNATURES: Record<ReceiptExtension, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  jpg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

/** Tipo permitido (PDF, JPG, JPEG, PNG), tamaño máximo y contenido real (firma del archivo). */
export function validateReceiptFile(
  file: ReceiptFile,
): { ok: true; extension: ReceiptExtension } | { ok: false; message: string } {
  const ext = EXTENSIONS[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!ext) return { ok: false, message: "Solo se admiten archivos PDF, JPG o PNG" };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: "El archivo supera los 10 MB" };
  if (file.size === 0) return { ok: false, message: "El archivo está vacío" };
  if (!startsWith(file.bytes, SIGNATURES[ext])) {
    return { ok: false, message: "El contenido del archivo no coincide con su tipo" };
  }
  return { ok: true, extension: ext };
}

export type PaymentInput = {
  bookingId: string;
  amount: string;
  currency: string;
  method: string;
  reference: string;
  file: ReceiptFile | null;
};

export type PaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; status: 400 | 404; errors: FieldErrors };

/** Alta de un cobro: monto, moneda, método y comprobante (referencia y/o archivo; al menos uno). */
export async function createPayment(
  db: PrismaClient,
  storage: ReceiptStorage,
  input: PaymentInput,
): Promise<PaymentResult> {
  const booking = await db.booking.findUnique({ where: { id: input.bookingId }, select: { id: true } });
  if (!booking) return { ok: false, status: 404, errors: { _form: "La reserva no existe" } };

  const errors: FieldErrors = {};
  const amount = parseMoney(input.amount);
  if (amount === "empty") errors.amount = "Este campo es obligatorio";
  else if (amount === "invalid") errors.amount = "Ingresá un monto mayor a 0, sin separador de miles (ej. 50000 o 50000,50)";

  if (input.currency !== "ARS" && input.currency !== "USD") errors.currency = "Elegí la moneda";
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) errors.method = "Elegí el método de pago";

  const reference = input.reference.trim();
  if (reference.length > 200) errors.reference = "La referencia admite hasta 200 caracteres";
  if (!reference && !input.file) errors.reference = "Cargá una referencia o un archivo";

  let extension: ReceiptExtension | null = null;
  if (input.file) {
    const checked = validateReceiptFile(input.file);
    if (checked.ok) extension = checked.extension;
    else errors.file = checked.message;
  }
  if (Object.keys(errors).length > 0) return { ok: false, status: 400, errors };

  const key = input.file && extension ? await storage.save(input.file.bytes, extension) : null;
  try {
    const payment = await db.payment.create({
      data: {
        bookingId: input.bookingId,
        amount: amount as number,
        currency: input.currency as "ARS" | "USD",
        method: input.method,
        reference: reference || null,
        receiptPath: key,
        receiptUploadedAt: key ? new Date() : null,
      },
    });
    return { ok: true, paymentId: payment.id };
  } catch (error) {
    if (key) await storage.remove(key); // no dejar archivos huérfanos si falla el guardado
    throw error;
  }
}
