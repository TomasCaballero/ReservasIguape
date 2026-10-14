import { describe, expect, it } from "vitest";
import { addMonths, nightsBetween, eachNight, todayInBuenosAires, formatDMY } from "@/lib/booking/dates";
import { validateGuests, validateStayDates } from "@/lib/booking/stay-rules";

const limits = { maxNights: 30, maxAdvanceMonths: 12 };
const TODAY = "2026-10-01";

describe("fechas", () => {
  it("la noche del check-out queda libre (AC-19)", () => {
    expect(eachNight("2026-11-10", "2026-11-14")).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
    ]);
    expect(nightsBetween("2026-11-10", "2026-11-14")).toBe(4); // AC-02
  });

  it("'hoy' usa Buenos Aires, no UTC (AC-10)", () => {
    // 23:30 del 01/10 en Buenos Aires = 02:30 UTC del 02/10
    expect(todayInBuenosAires(new Date("2026-10-02T02:30:00Z"))).toBe("2026-10-01");
  });

  it("suma meses sin desbordar", () => {
    expect(addMonths("2026-10-01", 12)).toBe("2027-10-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("formatea dd/MM/yyyy", () => {
    expect(formatDMY("2026-11-10")).toBe("10/11/2026");
  });
});

describe("validateStayDates (RF-08)", () => {
  it("rechaza check-in anterior a hoy y permite hoy (AC-09)", () => {
    expect(validateStayDates("2026-09-30", "2026-10-02", TODAY, limits)?.code).toBe("CHECKIN_IN_PAST");
    expect(validateStayDates("2026-10-01", "2026-10-02", TODAY, limits)).toBeNull();
  });

  it("rechaza check-out igual al check-in o anterior (AC-01, AC-11)", () => {
    expect(validateStayDates("2026-11-10", "2026-11-10", TODAY, limits)?.code).toBe("MIN_NIGHTS");
    expect(validateStayDates("2026-11-10", "2026-11-08", TODAY, limits)?.code).toBe("MIN_NIGHTS");
  });

  it("acepta 30 noches y rechaza 31 con el mensaje esperado (AC-12)", () => {
    expect(validateStayDates("2026-11-01", "2026-12-01", TODAY, limits)).toBeNull();
    expect(validateStayDates("2026-11-01", "2026-12-02", TODAY, limits)).toEqual({
      code: "MAX_NIGHTS",
      message: "El máximo es de 30 noches",
    });
  });

  it("limita la anticipación a 12 meses (AC-13)", () => {
    expect(validateStayDates("2027-10-01", "2027-10-03", TODAY, limits)).toBeNull();
    expect(validateStayDates("2027-10-02", "2027-10-04", TODAY, limits)?.code).toBe("TOO_FAR_AHEAD");
  });

  it("rechaza fechas inexistentes", () => {
    expect(validateStayDates("2026-13-45", "2026-11-10", TODAY, limits)?.code).toBe("INVALID_DATES");
  });
});

describe("validateGuests (RF-03)", () => {
  it("exige al menos 1 adulto (AC-04)", () => {
    expect(validateGuests(0)?.message).toBe("Se requiere al menos 1 adulto");
    expect(validateGuests(1)).toBeNull();
  });
});
