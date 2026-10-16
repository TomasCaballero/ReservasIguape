import { describe, expect, it } from "vitest";
import { upcomingBirthdays } from "@/lib/admin/birthdays";

const person = (id: string, birthDate: string, extra: { lastName?: string; anonymized?: boolean } = {}) => ({
  id,
  birthDate,
  lastName: extra.lastName ?? id,
  anonymized: extra.anonymized ?? false,
});
const ids = (list: ReturnType<typeof upcomingBirthdays>) => list.map((b) => b.customer.id);

describe("próximos cumpleañeros (RF-60)", () => {
  it("incluye al que cumple el 15/10 y excluye al del 15/11 con hoy 01/10 (AC-91)", () => {
    const result = upcomingBirthdays([person("oct", "1990-10-15"), person("nov", "1985-11-15")], "2026-10-01");
    expect(ids(result)).toEqual(["oct"]);
    expect(result[0]).toMatchObject({ date: "2026-10-15", inDays: 14 });
  });

  it("cruza el fin de año: hoy 20/12, cumple 05/01 (AC-92)", () => {
    const result = upcomingBirthdays([person("ene", "1992-01-05")], "2026-12-20");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ date: "2027-01-05", inDays: 16 });
  });

  it("31/10 entra (día 30) y 01/11 no (día 31) (AC-93)", () => {
    const result = upcomingBirthdays([person("a", "1990-10-31"), person("b", "1990-11-01")], "2026-10-01");
    expect(ids(result)).toEqual(["a"]);
    expect(result[0].inDays).toBe(30);
  });

  it("29/02 se celebra el 28/02 en año no bisiesto y el 29/02 en bisiesto (AC-94)", () => {
    const leapDay = person("bis", "2000-02-29");
    expect(upcomingBirthdays([leapDay], "2027-02-10")[0]).toMatchObject({ date: "2027-02-28", inDays: 18 });
    expect(upcomingBirthdays([leapDay], "2028-02-10")[0]).toMatchObject({ date: "2028-02-29", inDays: 19 });
  });

  it("incluye el cumpleaños de hoy (offset 0) (P-12)", () => {
    const result = upcomingBirthdays([person("hoy", "1980-10-01")], "2026-10-01");
    expect(result[0]).toMatchObject({ date: "2026-10-01", inDays: 0 });
  });

  it("excluye clientes anonimizados", () => {
    expect(upcomingBirthdays([person("anon", "1990-10-15", { anonymized: true })], "2026-10-01")).toEqual([]);
  });

  it("ordena por días y después por apellido", () => {
    const result = upcomingBirthdays(
      [
        person("c", "1990-10-20", { lastName: "Zeta" }),
        person("b", "1990-10-20", { lastName: "Alfa" }),
        person("a", "1990-10-05"),
      ],
      "2026-10-01",
    );
    expect(ids(result)).toEqual(["a", "b", "c"]);
  });
});
