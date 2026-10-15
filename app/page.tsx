import { BookingSearch } from "@/components/booking/BookingSearch";
import { todayInBuenosAires } from "@/lib/booking/dates";
import { parsePrefill } from "@/lib/booking/url-params";
import { prisma } from "@/lib/prisma";

export default async function Home({ searchParams }: PageProps<"/">) {
  const prefill = parsePrefill(await searchParams);

  const [settings, capacity, preselected] = await Promise.all([
    prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.category.aggregate({ _max: { maxCapacity: true } }),
    prefill.categorySlug
      ? prisma.category.findUnique({
          where: { slug: prefill.categorySlug },
          select: { slug: true, name: true },
        })
      : null,
  ]);

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-5">
          <p className="caption-text">Motor de reservas</p>
          <p className="font-display text-3xl">Iguapé Aparts</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-4xl">Reservá tu estadía</h1>
        <p className="mt-2 mb-10 max-w-prose">
          Elegí las fechas y la cantidad de huéspedes para ver los aparts disponibles y su precio final.
        </p>
        <BookingSearch
          today={todayInBuenosAires()}
          limits={{
            maxNights: settings.maxNights,
            maxAdvanceMonths: settings.maxAdvanceMonths,
          }}
          maxGuests={capacity._max.maxCapacity ?? 2}
          initial={{ checkIn: prefill.checkIn, checkOut: prefill.checkOut }}
          preselected={preselected}
        />
      </main>
    </>
  );
}
