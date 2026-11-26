import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasSteamApiKey, synchronizeSteamLibrary } from "@/features/steam/steam-service";
import { cronHeaders as headers, isAuthorizedCronRequest } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const batchSchema = z.array(z.object({
  user_id: z.uuid(),
  steam_id: z.string(),
  attempted_at: z.iso.datetime({ offset: true }),
})).max(3);

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ status: "unauthorized" }, { status: 401, headers });
  }
  const admin = createAdminClient();
  if (!admin || !hasSteamApiKey()) return Response.json({ status: "unavailable" }, { status: 503, headers });

  const deadline = Date.now() + 40_000;
  let attempted = 0;
  let succeeded = 0;
  let rateLimited = false;
  let unavailable = false;

  for (let index = 0; index < 4 && Date.now() < deadline; index++) {
    const { data, error } = await admin.rpc("reserve_steam_auto_sync_batch");
    const batch = batchSchema.safeParse(data);
    if (error || !batch.success) {
      unavailable = true;
      break;
    }
    if (!batch.data.length) break;

    const results = await Promise.all(batch.data.map(async (account) => {
      const result = await synchronizeSteamLibrary(admin, account.user_id, account.steam_id, account.attempted_at)
        .catch(() => "service-error" as const);
      const finished = await admin.rpc("finish_steam_auto_sync", {
        p_user_id: account.user_id, p_attempted_at: account.attempted_at, p_result: result,
      });
      return { result, recorded: !finished.error };
    }));

    attempted += results.length;
    succeeded += results.filter(({ result }) => result === "steam-synced" || result === "steam-empty").length;
    rateLimited = results.some(({ result }) => result === "steam-rate-limit");
    unavailable ||= results.some(({ recorded }) => !recorded);
    if (rateLimited || unavailable) break;
  }

  if (succeeded > 0) revalidatePath("/", "layout");
  return Response.json({
    status: unavailable ? "unavailable" : rateLimited ? "rate-limited" : "completed",
    attempted, succeeded,
  }, { status: unavailable ? 503 : 200, headers });
}
