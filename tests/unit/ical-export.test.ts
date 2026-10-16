import { describe, expect, it } from "vitest";
import { buildFeed } from "@/lib/ical/export";

describe("buildFeed", () => {
  const feed = buildFeed("Depto 1", [{ uid: "abc@iguape", start: "2026-11-10", end: "2026-11-14" }], new Date("2026-10-15T12:00:00Z"));

  it("exporta un evento del 10/11 al 14/11 con fin exclusivo y sin datos personales (AC-98)", () => {
    expect(feed).toContain("DTSTART;VALUE=DATE:20261110");
    expect(feed).toContain("DTEND;VALUE=DATE:20261114");
    expect(feed).toContain("SUMMARY:Ocupado");
    expect(feed).toContain("UID:abc@iguape");
    expect(feed).not.toMatch(/ATTENDEE|DESCRIPTION|ORGANIZER|@mail|\+54/);
  });

  it("usa CRLF en todas las líneas", () => {
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(feed.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("sin eventos sigue siendo un calendario válido", () => {
    expect(buildFeed("X", [])).not.toContain("BEGIN:VEVENT");
  });
});
