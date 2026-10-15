"use client";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const button =
    "flex h-12 w-12 items-center justify-center border border-border text-xl hover:bg-background-card disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-4">
      <span className="text-base">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={button}
          aria-label={`Quitar ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-live="polite" className="w-8 text-center text-lg">
          {value}
        </output>
        <button
          type="button"
          className={button}
          aria-label={`Agregar ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

type Props = {
  adults: number;
  kids: number;
  maxGuests: number;
  onChange: (guests: { adults: number; children: number }) => void;
};

/** RF-02: adultos y niños. El total no supera la mayor capacidad del catálogo. */
export function GuestsPicker({ adults, kids, maxGuests, onChange }: Props) {
  const total = adults + kids;
  return (
    <div className="flex flex-col gap-3">
      <Stepper
        label="Adultos"
        value={adults}
        min={0}
        max={Math.max(0, maxGuests - kids)}
        onChange={(v) => onChange({ adults: v, children: kids })}
      />
      <Stepper
        label="Niños"
        value={kids}
        min={0}
        max={Math.max(0, maxGuests - adults)}
        onChange={(v) => onChange({ adults, children: v })}
      />
      {total >= maxGuests && (
        <p className="text-sm">La mayor capacidad de nuestros aparts es de {maxGuests} huéspedes.</p>
      )}
    </div>
  );
}
