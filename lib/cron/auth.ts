import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer <CRON_SECRET>`. Sin secreto configurado, rechaza todo (D-11). */
export function isCronAuthorized(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
