import type { ReactNode } from "react";

// Campos de formulario con error accesible: aria-invalid + mensaje visible asociado (AC-26).

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: (a11y: { id: string; "aria-invalid": "true" | "false"; "aria-describedby"?: string }) => ReactNode;
};

export function Field({ id, label, error, children }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="caption-text">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? "true" : "false",
        "aria-describedby": error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="border-l-2 border-primary pl-2 text-sm text-primary">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-12 w-full border border-border bg-transparent px-3 text-text placeholder:text-text/50 aria-[invalid=true]:border-primary aria-[invalid=true]:border-2";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  prefix?: ReactNode;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  maxLength,
  prefix,
}: TextFieldProps) {
  return (
    <Field id={id} label={label} error={error}>
      {(a11y) => (
        <div className="flex items-stretch gap-2">
          {prefix}
          <input
            {...a11y}
            name={id}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            placeholder={placeholder}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
    </Field>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
};

export function SelectField({ id, label, value, onChange, options, error }: SelectFieldProps) {
  return (
    <Field id={id} label={label} error={error}>
      {(a11y) => (
        <select
          {...a11y}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-background text-text">
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** "10032026" → "10/03/2026" mientras se escribe. */
export function maskDMY(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** dd/mm/aaaa → AAAA-MM-DD. Vacío → ""; formato incompleto o inexistente → "invalid". */
export function dmyToISO(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "invalid";
}
