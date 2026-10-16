import type { NextRequest } from "next/server";
import { buildFeed, loadFeedEvents } from "@/lib/ical/export";
import { prisma } from "@/lib/prisma";

// RF-63: feed de una unidad. Fuera de `proxy.ts`: se valida solo. Cualquier token que no sea
// exactamente de 32 hex, o que no exista, responde 404 sin cuerpo (RNF-06, AC-108).
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/ical/[token]">) {
  const { token: raw } = await ctx.params;
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : "";
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response(null, { status: 404 });

  const unit = await prisma.unit.findUnique({ where: { icalToken: token }, select: { id: true, name: true } });
  if (!unit) return new Response(null, { status: 404 });

  return new Response(buildFeed(unit.name, await loadFeedEvents(prisma, unit.id)), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
