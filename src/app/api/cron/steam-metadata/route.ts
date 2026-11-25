import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";

import { processSteamMetadataBatch } from "@/features/steam/catalog-batch";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  const headers = { "Cache-Control": "no-store" };
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ status: "unauthorized" }, { status: 401, headers });
  }

  const admin = createAdminClient();
  if (!admin) return Response.json({ status: "unavailable" }, { status: 503, headers });

  const claim = await admin.rpc("claim_steam_metadata_schedule");
  if (claim.error || typeof claim.data !== "boolean") {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
  if (!claim.data) return Response.json({ status: "skipped" }, { headers });

  const deadline = Date.now() + 40_000;
  let reserved = 0;
  let enriched = 0;
  let retry = false;

  for (let index = 0; index < 4 && Date.now() < deadline; index++) {
    const batch = await processSteamMetadataBatch(admin, null);
    if (!batch) {
      retry = true;
      break;
    }
    reserved += batch.reserved;
    enriched += batch.enriched;
    retry ||= batch.retry;
    if (!batch.reserved || batch.rateLimited || (batch.retry && batch.enriched === 0)) break;
  }

  if (enriched > 0) revalidatePath("/", "layout");
  return Response.json({ status: retry ? "retry-pending" : "completed", reserved, enriched }, { headers });
}
