import "server-only";

import { timingSafeEqual } from "node:crypto";

export const cronHeaders = { "Cache-Control": "no-store" };

export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
