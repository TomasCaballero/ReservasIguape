import { addMonths, isValidISODate, nightsBetween, type ISODate } from "./dates";

export type StayErrorCode =
  | "INVALID_DATES"
  | "CHECKIN_IN_PAST"
  | "MIN_NIGHTS"
  | "MAX_NIGHTS"
  | "TOO_FAR_AHEAD"
  | "NO_ADULTS";

export type StayError = { code: StayErrorCode; message: string };

export type StayLimits = {
  maxNights: number;
  maxAdvanceMonths: number;
};

/** RF-08: valida el rango de fechas. Devuelve null si es válido. */
export function validateStayDates(
  checkIn: string,
  checkOut: string,
  today: ISODate,
  limits: StayLimits,
): StayError | null {
  if (!isValidISODate(checkIn) || !isValidISODate(checkOut)) {
    return { code: "INVALID_DATES", message: "Las fechas no son válidas" };
  }
  if (checkIn < today) {
    return { code: "CHECKIN_IN_PAST", message: "El check-in no puede ser anterior a hoy" };
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    return { code: "MIN_NIGHTS", message: "La estadía mínima es de 1 noche" };
  }
  if (nights > limits.maxNights) {
    return { code: "MAX_NIGHTS", message: `El máximo es de ${limits.maxNights} noches` };
  }
  if (checkIn > addMonths(today, limits.maxAdvanceMonths)) {
    return {
      code: "TOO_FAR_AHEAD",
      message: `Solo se puede reservar con hasta ${limits.maxAdvanceMonths} meses de anticipación`,
    };
  }
  return null;
}

/** RF-03: al menos 1 adulto. */
export function validateGuests(adults: number): StayError | null {
  return adults >= 1
    ? null
    : { code: "NO_ADULTS", message: "Se requiere al menos 1 adulto" };
}
