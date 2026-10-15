"use client";

import { useEffect, useState } from "react";
import { nightsBetween, formatDMY, type ISODate } from "@/lib/booking/dates";
import type { Currency } from "@/lib/booking/pricing";
import type { SearchResult } from "@/lib/booking/search";
import { validateGuests, validateStayDates, type StayError } from "@/lib/booking/stay-rules";
import { formatGuests, formatNights } from "@/lib/format";
import { CategoryCard } from "./CategoryCard";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { GuestsPicker } from "./GuestsPicker";

type Props = {
  today: ISODate;
  limits: { maxNights: number; maxAdvanceMonths: number };
  maxGuests: number;
  initial: { checkIn: ISODate | null; checkOut: ISODate | null };
  preselected: { slug: string; name: string } | null;
};

type ApiPayload = { results?: SearchResult[]; error?: StayError };
type Fetched = { key: string; payload: ApiPayload | null };

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos (ARS)" },
  { value: "USD", label: "Dólares (USD)" },
];

/** Portal público: búsqueda de disponibilidad y precios (RF-01 a RF-16). */
export function BookingSearch({ today, limits, maxGuests, initial, preselected }: Props) {
  const [range, setRange] = useState<DateRange>({
    checkIn: initial.checkIn,
    checkOut: initial.checkOut,
  });
  const [guests, setGuests] = useState({ adults: 2, children: 0 });
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(preselected?.slug ?? null);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  const { checkIn, checkOut } = range;
  const guestsError = validateGuests(guests.adults);
  const stayError =
    checkIn && checkOut ? validateStayDates(checkIn, checkOut, today, limits) : null;
  const error = guestsError ?? stayError;

  const query =
    checkIn && checkOut && !error
      ? new URLSearchParams({
          checkin: checkIn,
          checkout: checkOut,
          adults: String(guests.adults),
          children: String(guests.children),
          currency,
        }).toString()
      : null;

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetch(`/api/availability?${query}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<ApiPayload>)
      .then((payload) => setFetched({ key: query, payload }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetched({ key: query, payload: null });
      });
    return () => controller.abort();
  }, [query]);

  const current = query && fetched?.key === query ? fetched : null;
  const loading = query !== null && current === null;
  const results = current?.payload?.results ?? null;
  const serverError = current?.payload?.error ?? null;
  const failed = current !== null && current.payload === null;

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const preselectedMissing =
    preselected !== null && results !== null && !results.some((r) => r.category.slug === preselected.slug);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="fechas" className="grid gap-8 lg:grid-cols-[auto_1fr]">
        <div>
          <h2 id="fechas" className="text-2xl">
            Fechas
          </h2>
          <p className="caption-text mt-1">Check-in y check-out</p>
          <p className="mt-3 min-h-12" data-testid="date-summary">
            {checkIn && checkOut ? (
              <>
                {formatDMY(checkIn)} – {formatDMY(checkOut)}
                <br />
                {formatNights(nights)}
              </>
            ) : checkIn ? (
              <>Check-in: {formatDMY(checkIn)}. Elegí el check-out.</>
            ) : (
              <>Elegí el check-in.</>
            )}
          </p>
          <DateRangePicker
            value={range}
            onChange={setRange}
            today={today}
            maxAdvanceMonths={limits.maxAdvanceMonths}
            maxNights={limits.maxNights}
          />
          {(checkIn || checkOut) && (
            <button
              type="button"
              className="btn-outlined mt-3"
              onClick={() => setRange({ checkIn: null, checkOut: null })}
            >
              Limpiar fechas
            </button>
          )}
        </div>

        <div className="flex max-w-md flex-col gap-8">
          <div>
            <h2 className="text-2xl">Huéspedes</h2>
            <div className="mt-3">
              <GuestsPicker
                adults={guests.adults}
                kids={guests.children}
                maxGuests={maxGuests}
                onChange={setGuests}
              />
            </div>
            <p className="mt-3" data-testid="guests-summary">
              {formatGuests(guests.adults, guests.children)}
            </p>
          </div>

          <div role="group" aria-labelledby="moneda">
            <h2 id="moneda" className="text-2xl">
              Moneda
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {CURRENCIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={currency === c.value ? "btn-filled" : "btn-outlined"}
                  aria-pressed={currency === c.value}
                  onClick={() => setCurrency(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="resultados" aria-live="polite">
        <h2 id="resultados" className="text-2xl">
          Aparts disponibles
        </h2>

        {guestsError && (
          <p role="alert" className="mt-3 border border-primary p-3">
            {guestsError.message}
          </p>
        )}
        {stayError && (
          <p role="alert" className="mt-3 border border-primary p-3">
            {stayError.message}
          </p>
        )}
        {!error && !(checkIn && checkOut) && (
          <p className="mt-3">Elegí las fechas para ver disponibilidad y precios.</p>
        )}
        {loading && <p className="mt-3">Buscando disponibilidad…</p>}
        {(failed || serverError) && (
          <p role="alert" className="mt-3 border border-primary p-3">
            {serverError?.message ?? "No pudimos consultar la disponibilidad. Probá de nuevo."}
          </p>
        )}

        {preselectedMissing && (
          <p className="mt-3 border border-border p-3">
            {preselected?.name} no tiene disponibilidad para esas fechas y huéspedes.
          </p>
        )}
        {results && results.length === 0 && (
          <p className="mt-3">No hay aparts disponibles para esa búsqueda.</p>
        )}
        {results && results.length > 0 && (
          <ul className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => (
              <CategoryCard
                key={r.category.id}
                result={r}
                selected={selectedSlug === r.category.slug}
                onSelect={() => setSelectedSlug(r.category.slug)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
