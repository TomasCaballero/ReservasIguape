import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ISODate } from "./dates";
import { quoteStay, type Currency, type DiscountRuleInput, type Quote, type SeasonInput } from "./pricing";

type Db = Pick<PrismaClient, "season" | "discountRule">;

export type PricingContext = {
  seasons: (Omit<SeasonInput, "price"> & { prices: Map<string, SeasonInput["price"]> })[];
  rules: DiscountRuleInput[];
};

const num = (d: { toString(): string }) => Number(d.toString());
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Temporadas que tocan el rango y reglas de descuento activas. */
export async function loadPricingContext(
  db: Db,
  checkIn: ISODate,
  checkOut: ISODate,
): Promise<PricingContext> {
  const [seasons, rules] = await Promise.all([
    db.season.findMany({
      where: { startDate: { lte: new Date(checkOut) }, endDate: { gte: new Date(checkIn) } },
      include: { prices: true },
    }),
    db.discountRule.findMany({ where: { active: true } }),
  ]);
  return {
    seasons: seasons.map((s) => ({
      startDate: isoDate(s.startDate),
      endDate: isoDate(s.endDate),
      minNights: s.minNights,
      prices: new Map(
        s.prices.map((p) => [p.categoryId, { ars: num(p.priceArs), usd: num(p.priceUsd) }]),
      ),
    })),
    rules: rules.map((r) => ({ minNights: r.minNights, percent: num(r.percent), active: r.active })),
  };
}

/** Cotiza una categoría con el precio base, sus precios de temporada y los descuentos. */
export function quoteForCategory(
  category: { id: string; basePriceArs: { toString(): string }; basePriceUsd: { toString(): string } },
  context: PricingContext,
  stay: { checkIn: ISODate; checkOut: ISODate; currency: Currency },
): Quote {
  return quoteStay({
    ...stay,
    basePrice: { ars: num(category.basePriceArs), usd: num(category.basePriceUsd) },
    seasons: context.seasons.map((s) => ({
      startDate: s.startDate,
      endDate: s.endDate,
      minNights: s.minNights,
      price: s.prices.get(category.id) ?? null,
    })),
    discountRules: context.rules,
  });
}
