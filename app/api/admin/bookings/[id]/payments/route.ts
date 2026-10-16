import { NextResponse, type NextRequest } from "next/server";
import { createPayment } from "@/lib/admin/payments";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";
import { localReceiptStorage } from "@/lib/storage/receipts";

// RF-55: alta de un cobro con comprobante opcional (multipart). Solo con sesión de admin (AC-106).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/bookings/[id]/payments">) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "No autorizado" } }, { status: 401 });
  }
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Solicitud inválida" } }, { status: 400 });
  }
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const upload = form.get("file");
  const file =
    upload instanceof File && upload.size > 0
      ? { name: upload.name, size: upload.size, bytes: Buffer.from(await upload.arrayBuffer()) }
      : null;

  const result = await createPayment(prisma, localReceiptStorage(), {
    bookingId: id,
    amount: text("amount"),
    currency: text("currency"),
    method: text("method"),
    reference: text("reference"),
    file,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: result.status });
  }
  return NextResponse.json({ ok: true, paymentId: result.paymentId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
