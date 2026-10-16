import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { runJobs } from "@/lib/cron/jobs";
import { prisma } from "@/lib/prisma";
import { localReceiptStorage } from "@/lib/storage/receipts";

// RF-66: un solo endpoint para todas las tareas programadas. Fuera de `proxy.ts`: se valida
// con `CRON_SECRET`. Sin credencial válida, 401 sin datos.
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  return NextResponse.json(await runJobs(prisma, localReceiptStorage()), { headers: { "Cache-Control": "no-store" } });
}
