import { isValidISODate, type ISODate } from "./dates";

export type PrefillParams = {
  checkIn: ISODate | null;
  checkOut: ISODate | null;
  categorySlug: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * RF-05, RF-06, RF-07: preselección desde la URL. Todo valor inválido se ignora
 * sin error y deja vacío el campo correspondiente. El check-out solo se acepta
 * junto a un check-in válido y posterior a él. El slug se valida contra el
 * catálogo en el servidor.
 */
export function parsePrefill(raw: RawParams): PrefillParams {
  const checkinParam = first(raw.checkin);
  const checkoutParam = first(raw.checkout);
  const slugParam = first(raw.categoria);

  const checkIn = checkinParam && isValidISODate(checkinParam) ? checkinParam : null;
  const checkOut =
    checkIn && checkoutParam && isValidISODate(checkoutParam) && checkoutParam > checkIn
      ? checkoutParam
      : null;
  const categorySlug = slugParam && /^[a-z0-9-]{1,80}$/.test(slugParam) ? slugParam : null;

  return { checkIn, checkOut, categorySlug };
}
