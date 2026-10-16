"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { addDays, addMonths, type ISODate } from "@/lib/booking/dates";

export type DateRange = { checkIn: ISODate | null; checkOut: ISODate | null };

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today: ISODate; // calculado en el servidor, en Buenos Aires (RNF-09)
  maxAdvanceMonths: number;
  maxNights: number;
};

const toDate = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toISO = (date: Date): ISODate => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const subscribeWide = (notify: () => void) => {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const isWide = () => window.matchMedia("(min-width: 768px)").matches;

/**
 * RF-01. Primero se elige el check-in y después el check-out. Con el check-in
 * elegido no se puede elegir un check-out igual o anterior (AC-01, AC-11) ni un
 * check-in anterior a hoy (AC-09). Máximo de noches y anticipación se validan
 * con mensaje en el formulario (AC-12, AC-13).
 */
export function DateRangePicker({ value, onChange, today, maxAdvanceMonths, maxNights }: Props) {
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const { checkIn, checkOut } = value;
  const choosingCheckOut = checkIn !== null && checkOut === null;

  const disabled = [
    { before: toDate(today) },
    ...(choosingCheckOut ? [{ before: toDate(addDays(checkIn, 1)) }] : []),
  ];

  const handleDayClick = (day: Date) => {
    const iso = toISO(day);
    onChange(choosingCheckOut ? { checkIn, checkOut: iso } : { checkIn: iso, checkOut: null });
  };

  return (
    <div className="date-range-picker">
      <DayPicker
        mode="range"
        locale={es}
        weekStartsOn={1}
        formatters={{
          formatCaption: (month) => {
            const text = format(month, "LLLL yyyy", { locale: es });
            return text.charAt(0).toUpperCase() + text.slice(1);
          },
        }}
        numberOfMonths={wide ? 2 : 1}
        defaultMonth={toDate(checkIn ?? today)}
        startMonth={toDate(today)}
        endMonth={toDate(addDays(addMonths(today, maxAdvanceMonths), maxNights))}
        selected={{
          from: checkIn ? toDate(checkIn) : undefined,
          to: checkOut ? toDate(checkOut) : undefined,
        }}
        disabled={disabled}
        onDayClick={handleDayClick}
      />
    </div>
  );
}
