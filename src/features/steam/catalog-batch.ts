import "server-only";

import { z } from "zod";

import type { createAdminClient } from "@/lib/supabase/admin";

import { fetchSteamMetadata } from "./catalog-metadata";

const reservedGames = z.array(z.object({
  game_id: z.uuid(),
  external_id: z.string(),
  reserved_until: z.iso.datetime({ offset: true }),
})).max(12);

export async function processSteamMetadataBatch(
  admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string | null,
) {
  const { data, error } = await admin.rpc("reserve_steam_metadata_batch", { p_user_id: userId });
  const reserved = reservedGames.safeParse(data);
  if (error || !reserved.success) return null;

  let enriched = 0;
  let retry = false;
  let rateLimited = false;
  for (let offset = 0; offset < reserved.data.length; offset += 4) {
    const wave = await Promise.all(reserved.data.slice(offset, offset + 4).map(async (game) => {
      const metadata = await fetchSteamMetadata(game.external_id);
      if (metadata.status === "rate-limited" || metadata.status === "unavailable") return metadata.status;

      const { data, error } = await admin.rpc("save_steam_metadata", {
        p_game_id: game.game_id,
        p_reserved_until: game.reserved_until,
        p_description: metadata.status === "available" ? metadata.description : null,
        p_genres: metadata.status === "available" ? metadata.genres : [],
        p_release_year: metadata.status === "available" ? metadata.releaseYear : null,
      });
      if (error || typeof data !== "boolean") return "unavailable";
      return data ? "enriched" : "unchanged";
    }));

    enriched += wave.filter((result) => result === "enriched").length;
    if (wave.includes("rate-limited")) {
      rateLimited = true;
      retry = true;
      break;
    }
    retry ||= wave.includes("unavailable");
  }

  return { reserved: reserved.data.length, enriched, retry, rateLimited };
}
