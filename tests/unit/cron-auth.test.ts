import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron/auth";

describe("isCronAuthorized", () => {
  it("acepta solo Bearer <secreto>", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized("Bearer otro", "s3cret")).toBe(false);
    expect(isCronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isCronAuthorized("Basic s3cret", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
  });

  it("sin secreto configurado rechaza todo", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronAuthorized(null, undefined)).toBe(false);
  });
});
