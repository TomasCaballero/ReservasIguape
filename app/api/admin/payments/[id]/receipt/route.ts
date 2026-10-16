import { NextResponse, type NextRequest } from "next/server";
import { RECEIPT_CONTENT_TYPE, type ReceiptExtension } from "@/lib/admin/payments";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";
import { localReceiptStorage } from "@/lib/storage/receipts";

// RF-55: el comprobante solo se entrega a un admin con sesión; nunca desde una URL pública.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/payments/[id]/receipt">) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "No autorizado" } }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });

  const payment = await prisma.payment.findUnique({ where: { id }, select: { receiptPath: true } });
  if (!payment?.receiptPath) return new NextResponse(null, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await localReceiptStorage().read(payment.receiptPath);
  } catch {
    return new NextResponse(null, { status: 404 }); // archivo ya limpiado (RF-56)
  }
  const ext = payment.receiptPath.split(".").pop() as ReceiptExtension;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": RECEIPT_CONTENT_TYPE[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="comprobante.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
