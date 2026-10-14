import type { PrismaClient } from "@/app/generated/prisma/client";
import { findAvailableCategories } from "./availability";
import { todayInBuenosAires, type ISODate } from "./dates";
import { quoteStay, type Currency, type Quote } from "./pricing";
import { validateGuests, validateStayDates, type StayError } from "./stay-rules";

export type SearchInput = {
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  currency: Currency;
};

export type SearchResult = {
  category: { id: string; slug: string; name: string; description: string; maxCapacity: number };
  availableUnits: number;
  quote: Quote;
};

const num = (d: { toString(): string }) => Number(d.toString());
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Motor de búsqueda: valida, filtra por disponibilidad y capacidad, y cotiza (RF-04, 08..16). */
export async function searchStays(
  prisma: PrismaClient,
  input: SearchInput,
  now: Date = new Date(),
): Promise<{ error: StayError } | { results: SearchResult[] }> {
  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });

  const error =
    validateGuests(input.adults) ??
    validateStayDates(input.checkIn, input.checkOut, todayInBuenosAires(now), settings);
  if (error) return { error };

  const available = await findAvailableCategories(prisma, {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.adults + input.children,
  });
  if (available.length === 0) return { results: [] };

  const [categories, seasons, rules] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: available.map((a) => a.categoryId) } },
      orderBy: { name: "asc" },
    }),
    prisma.season.findMany({
      where: {
        startDate: { lte: new Date(input.checkOut) },
        endDate: { gte: new Date(input.checkIn) },
      },
      include: { prices: true },
    }),
    prisma.discountRule.findMany({ where: { active: true } }),
  ]);

  const results = categories.map((category): SearchResult => {
    const quote = quoteStay({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      currency: input.currency,
      basePrice: { ars: num(category.basePriceArs), usd: num(category.basePriceUsd) },
      seasons: seasons.map((s) => {
        const p = s.prices.find((sp) => sp.categoryId === category.id);
        return {
          startDate: isoDate(s.startDate),
          endDate: isoDate(s.endDate),
          minNights: s.minNights,
          price: p ? { ars: num(p.priceArs), usd: num(p.priceUsd) } : null,
        };
      }),
      discountRules: rules.map((r) => ({
        minNights: r.minNights,
        percent: num(r.percent),
        active: r.active,
      })),
    });
    return {
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        maxCapacity: category.maxCapacity,
      },
      availableUnits: available.find((a) => a.categoryId === category.id)?.availableUnits ?? 0,
      quote,
    };
  });
  return { results };
}
