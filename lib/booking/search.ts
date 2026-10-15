import type { PrismaClient } from "@/app/generated/prisma/client";
import { findAvailableCategories } from "./availability";
import { todayInBuenosAires, type ISODate } from "./dates";
import type { Currency, Quote } from "./pricing";
import { loadPricingContext, quoteForCategory } from "./quote";
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

  const [categories, context] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: available.map((a) => a.categoryId) } },
      orderBy: { name: "asc" },
    }),
    loadPricingContext(prisma, input.checkIn, input.checkOut),
  ]);

  const results = categories.map(
    (category): SearchResult => ({
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        maxCapacity: category.maxCapacity,
      },
      availableUnits: available.find((a) => a.categoryId === category.id)?.availableUnits ?? 0,
      quote: quoteForCategory(category, context, input),
    }),
  );
  return { results };
}
