import { isKnownPrefix } from "./countries";
import { addMonths, isValidISODate, type ISODate } from "./dates";

// Validación del titular y de los acompañantes (RF-17 a RF-23). Se usa igual en
// el navegador y en el servidor: el servidor nunca confía en lo que validó el cliente.

export type DocumentType = "DNI" | "PASSPORT";

export type HolderInput = {
  firstName: string;
  lastName: string;
  email: string;
  phonePrefix: string; // "+54"
  phoneNumber: string; // sin prefijo
  documentType: DocumentType;
  documentNumber: string;
  birthDate: string; // AAAA-MM-DD
};

export type CompanionInput = {
  firstName: string;
  lastName: string;
  documentNumber: string;
  birthDate: string;
};

/** Mapa campo → mensaje. Claves: `firstName`, … y `companions.0.firstName`, … */
export type FieldErrors = Record<string, string>;

const REQUIRED = "Este campo es obligatorio";
const NAME_MAX = 80;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // usuario@dominio.tld (RF-19)
const PHONE = /^\d{6,12}$/; // RF-21
const DNI = /^\d{7,8}$/; // RF-22
const PASSPORT = /^[A-Za-z0-9]{6,9}$/; // RF-22

export function normalizeDocument(type: DocumentType, number: string): string {
  const trimmed = number.trim();
  return type === "PASSPORT" ? trimmed.toUpperCase() : trimmed;
}

function validateName(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return REQUIRED;
  if (v.length > NAME_MAX) return `${label} es demasiado largo`;
  return null;
}

/** RF-18: 18 años cumplidos o más a la fecha de hoy. */
export function isAdultOn(birthDate: ISODate, today: ISODate): boolean {
  return birthDate <= addMonths(today, -18 * 12);
}

function validateBirthDate(value: string, today: ISODate, mustBeAdult: boolean): string | null {
  if (!value) return REQUIRED;
  if (!isValidISODate(value)) return "Ingresá una fecha válida (dd/mm/aaaa)";
  if (value > today) return "La fecha de nacimiento no puede ser futura";
  if (mustBeAdult && !isAdultOn(value, today)) return "El titular debe ser mayor de 18 años";
  return null;
}

export function validateHolder(input: HolderInput, today: ISODate): FieldErrors {
  const errors: FieldErrors = {};
  const set = (field: string, message: string | null) => {
    if (message) errors[field] = message;
  };

  set("firstName", validateName(input.firstName, "El nombre"));
  set("lastName", validateName(input.lastName, "El apellido"));

  const email = input.email.trim();
  set("email", !email ? REQUIRED : EMAIL.test(email) ? null : "Ingresá un email válido (usuario@dominio.com)");

  const phone = input.phoneNumber.trim();
  if (!isKnownPrefix(input.phonePrefix)) errors.phonePrefix = "Elegí un país";
  set(
    "phoneNumber",
    !phone ? REQUIRED : PHONE.test(phone) ? null : "El teléfono debe tener entre 6 y 12 dígitos, sin letras ni espacios",
  );

  const doc = normalizeDocument(input.documentType, input.documentNumber);
  if (input.documentType !== "DNI" && input.documentType !== "PASSPORT") {
    errors.documentType = "Elegí el tipo de documento";
  }
  set(
    "documentNumber",
    !doc
      ? REQUIRED
      : input.documentType === "DNI"
        ? DNI.test(doc)
          ? null
          : "El DNI debe tener 7 u 8 dígitos"
        : PASSPORT.test(doc)
          ? null
          : "El pasaporte debe tener entre 6 y 9 letras o números",
  );

  set("birthDate", validateBirthDate(input.birthDate, today, true));
  return errors;
}

/** RF-23: cada acompañante cargado debe tener sus cuatro datos. */
export function validateCompanions(companions: CompanionInput[], today: ISODate): FieldErrors {
  const errors: FieldErrors = {};
  companions.forEach((c, i) => {
    const set = (field: string, message: string | null) => {
      if (message) errors[`companions.${i}.${field}`] = message;
    };
    set("firstName", validateName(c.firstName, "El nombre"));
    set("lastName", validateName(c.lastName, "El apellido"));
    const doc = c.documentNumber.trim();
    set(
      "documentNumber",
      !doc ? REQUIRED : /^[A-Za-z0-9]{4,20}$/.test(doc) ? null : "El documento debe tener entre 4 y 20 letras o números",
    );
    set("birthDate", validateBirthDate(c.birthDate, today, false));
  });
  return errors;
}
