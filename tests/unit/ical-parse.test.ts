import { describe, expect, it } from "vitest";
import { parseIcal } from "@/lib/ical/parse";

const TODAY = "2026-10-15";
const cal = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const ev = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("parseIcal", () => {
  it("lee un evento de día completo con fin exclusivo (AC-99)", () => {
    const text = cal(ev("UID:a@x", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261122"));
    expect(parseIcal(text, TODAY)).toEqual([{ uid: "a@x", start: "2026-11-20", end: "2026-11-22" }]);
  });

  it("sin DTEND dura una noche", () => {
    const text = cal(ev("UID:a", "DTSTART;VALUE=DATE:20261120"));
    expect(parseIcal(text, TODAY)[0].end).toBe("2026-11-21");
  });

  it("DATE-TIME en UTC pasa a la fecha de Buenos Aires", () => {
    const text = cal(ev("UID:a", "DTSTART:20261121T010000Z", "DTEND:20261123T150000Z"));
    expect(parseIcal(text, TODAY)).toEqual([{ uid: "a", start: "2026-11-20", end: "2026-11-23" }]);
  });

  it("descarta cancelados, pasados, rangos inválidos y eventos sin UID", () => {
    const text = cal(
      ev("UID:c", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261122", "STATUS:CANCELLED"),
      ev("UID:p", "DTSTART;VALUE=DATE:20260101", "DTEND;VALUE=DATE:20260105"),
      ev("UID:i", "DTSTART;VALUE=DATE:20261125", "DTEND;VALUE=DATE:20261125"),
      ev("DTSTART;VALUE=DATE:20261120"),
      ev("UID:ok", "DTSTART;VALUE=DATE:20261201", "DTEND;VALUE=DATE:20261203"),
    );
    expect(parseIcal(text, TODAY).map((e) => e.uid)).toEqual(["ok"]);
  });

  it("ignora SUMMARY y DESCRIPTION, incluso con líneas continuadas", () => {
    const text = cal(
      ev(
        "UID:a",
        "SUMMARY:Reservado por Juan Perez",
        "DESCRIPTION:Tel 11 5555 1234 y una linea",
        " continuada",
        "DTSTART;VALUE=DATE:20261120",
        "DTEND;VALUE=DATE:20261122",
      ),
    );
    const [event] = parseIcal(text, TODAY);
    expect(Object.keys(event).sort()).toEqual(["end", "start", "uid"]);
    expect(JSON.stringify(event)).not.toMatch(/Juan|5555/);
  });

  it("desdobla líneas y acepta LF solo", () => {
    const text = "BEGIN:VEVENT\nUID:abc\n def\nDTSTART;VALUE=DATE:20261120\nEND:VEVENT\n";
    expect(parseIcal(text, TODAY)[0].uid).toBe("abcdef");
  });
});
