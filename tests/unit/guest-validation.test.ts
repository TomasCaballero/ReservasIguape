import { describe, expect, it } from "vitest";
import {
  isAdultOn,
  validateCompanions,
  validateHolder,
  type HolderInput,
} from "@/lib/booking/guest-validation";

const TODAY = "2026-10-01";
const valid: HolderInput = {
  firstName: "Juan",
  lastName: "Pérez",
  email: "juan@mail.com",
  phonePrefix: "+54",
  phoneNumber: "1155551234",
  documentType: "DNI",
  documentNumber: "30111222",
  birthDate: "1990-05-20",
};
const errorsFor = (patch: Partial<HolderInput>) => validateHolder({ ...valid, ...patch }, TODAY);

describe("titular (RF-17)", () => {
  it("un formulario completo no tiene errores", () => {
    expect(validateHolder(valid, TODAY)).toEqual({});
  });

  it.each([
    ["firstName", ""],
    ["lastName", "  "],
    ["email", ""],
    ["phoneNumber", ""],
    ["documentNumber", ""],
    ["birthDate", ""],
  ] as const)("el campo obligatorio %s vacío da error (AC-26)", (field, value) => {
    expect(errorsFor({ [field]: value })[field]).toBe("Este campo es obligatorio");
  });
});

describe("edad (RF-18, AC-27)", () => {
  it("17 años: bloqueado; 18 años exactos: permitido", () => {
    expect(isAdultOn("2008-10-02", TODAY)).toBe(false);
    expect(isAdultOn("2008-10-01", TODAY)).toBe(true);
    expect(errorsFor({ birthDate: "2008-10-02" }).birthDate).toBeDefined();
    expect(errorsFor({ birthDate: "2008-10-01" }).birthDate).toBeUndefined();
  });

  it("rechaza fechas futuras e inexistentes", () => {
    expect(errorsFor({ birthDate: "2030-01-01" }).birthDate).toBeDefined();
    expect(errorsFor({ birthDate: "1990-02-30" }).birthDate).toBeDefined();
  });
});

describe("email (RF-19, AC-28)", () => {
  it("'juan@' se bloquea y 'juan@mail.com' se permite", () => {
    expect(errorsFor({ email: "juan@" }).email).toBeDefined();
    expect(errorsFor({ email: "juan@mail" }).email).toBeDefined();
    expect(errorsFor({ email: "juan@mail.com" }).email).toBeUndefined();
  });
});

describe("teléfono (RF-20, RF-21, AC-30)", () => {
  it("entre 6 y 12 dígitos", () => {
    for (const bad of ["12345", "1234567890123", "11555a1234", "11 5555 1234"]) {
      expect(errorsFor({ phoneNumber: bad }).phoneNumber, bad).toBeDefined();
    }
    for (const ok of ["123456", "123456789012"]) {
      expect(errorsFor({ phoneNumber: ok }).phoneNumber, ok).toBeUndefined();
    }
  });

  it("exige un prefijo de país conocido", () => {
    expect(errorsFor({ phonePrefix: "+999" }).phonePrefix).toBeDefined();
    expect(errorsFor({ phonePrefix: "+598" }).phonePrefix).toBeUndefined();
  });
});

describe("documento (RF-22, AC-31, AC-32)", () => {
  it("DNI de 7 u 8 dígitos", () => {
    for (const bad of ["123456", "123456789", "1234567a"]) {
      expect(errorsFor({ documentNumber: bad }).documentNumber, bad).toBeDefined();
    }
    for (const ok of ["1234567", "12345678"]) {
      expect(errorsFor({ documentNumber: ok }).documentNumber, ok).toBeUndefined();
    }
  });

  it("pasaporte alfanumérico de 6 a 9 caracteres", () => {
    const passport = (n: string) => errorsFor({ documentType: "PASSPORT", documentNumber: n }).documentNumber;
    expect(passport("AB123")).toBeDefined();
    expect(passport("AB12345678")).toBeDefined();
    expect(passport("AB-12345")).toBeDefined();
    expect(passport("AB1234")).toBeUndefined();
    expect(passport("AB1234567")).toBeUndefined();
  });
});

describe("acompañantes (RF-23)", () => {
  it("son opcionales: sin acompañantes no hay errores", () => {
    expect(validateCompanions([], TODAY)).toEqual({});
  });

  it("cada acompañante cargado necesita sus cuatro datos, con error por posición", () => {
    const errors = validateCompanions(
      [
        { firstName: "Ana", lastName: "Gómez", documentNumber: "30111222", birthDate: "1992-02-02" },
        { firstName: "", lastName: "Gómez", documentNumber: "", birthDate: "" },
      ],
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual([
      "companions.1.birthDate",
      "companions.1.documentNumber",
      "companions.1.firstName",
    ]);
  });
});
