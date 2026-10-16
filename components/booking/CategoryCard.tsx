import Image from "next/image";
import type { SearchResult } from "@/lib/booking/search";
import { formatDiscount, formatMoney, formatNights } from "@/lib/format";

type Props = {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
};

/** RF-11 a RF-13, RF-16: tarifa por noche, noches, subtotal, descuento y total. */
export function CategoryCard({ result, selected, onSelect }: Props) {
  const { category, quote } = result;
  const { currency } = quote;

  // RF-11: si las noches tienen precios distintos, se muestra cada uno.
  const groups = new Map<number, number>();
  for (const night of quote.nights) groups.set(night.price, (groups.get(night.price) ?? 0) + 1);
  const mixedPrices = groups.size > 1;
  const blocked = quote.minStayError !== null;

  return (
    <li
      className={`flex flex-col gap-4 border bg-background-card ${
        selected ? "border-primary" : "border-border"
      }`}
      data-testid="category-card"
      data-slug={category.slug}
    >
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={`/aparts/${category.slug}.webp`}
          alt={`Apart ${category.name}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="px-5">
        <h3 className="text-2xl">{category.name}</h3>
        <p className="mt-1">{category.description}</p>
        <p className="caption-text mt-2">Hasta {category.maxCapacity} huéspedes</p>
      </div>

      <div className="px-5">
        {mixedPrices ? (
          <ul>
            {[...groups].map(([price, count]) => (
              <li key={price}>
                {formatNights(count)} a {formatMoney(price, currency)}/noche
              </li>
            ))}
          </ul>
        ) : (
          <p>{formatMoney(quote.nights[0].price, currency)}/noche</p>
        )}
        <p>{formatNights(quote.nightCount)}</p>

        {quote.discountPercent > 0 && (
          <dl className="mt-2">
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd>{formatMoney(quote.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Descuento ({quote.discountPercent}%)</dt>
              <dd>{formatDiscount(quote.discountAmount, currency)}</dd>
            </div>
          </dl>
        )}
        <p className="mt-2 text-xl">Total: {formatMoney(quote.total, currency)}</p>
      </div>

      {blocked ? (
        <p role="alert" className="mx-5 mb-5 border border-primary p-3">
          {quote.minStayError}
        </p>
      ) : (
        <button
          type="button"
          className={`${selected ? "btn-filled" : "btn-outlined"} mx-5 mb-5`}
          aria-pressed={selected}
          onClick={onSelect}
        >
          {selected ? "Seleccionada" : "Elegir"}
        </button>
      )}
    </li>
  );
}
