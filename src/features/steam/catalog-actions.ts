"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { MutationResult } from "@/features/library/actions";
import { getLibraryViewer } from "@/features/library/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimExternalRequest } from "@/lib/supabase/external-requests";

import { fetchSteamMetadata } from "./catalog-metadata";

const reservedGames = z.array(z.object({
  game_id: z.uuid(),
  external_id: z.string(),
  reserved_until: z.iso.datetime({ offset: true }),
})).max(12);

const failed = { message: "L’enrichissement des fiches est temporairement indisponible.", error: true };

export async function enrichSteamCatalog(): Promise<MutationResult> {
  const viewer = await getLibraryViewer(true);
  if (!viewer) return { message: "Reconnecte-toi à GameVault pour enrichir tes fiches Steam.", error: true };

  const admin = createAdminClient();
  if (!admin) return failed;
  const quota = await claimExternalRequest(admin, viewer.userId, "steam_metadata");
  if (quota === "limited") return { message: "Limite horaire d’enrichissement atteinte. Réessaie à l’heure suivante.", error: true };
  if (quota === "error") return failed;

  const { data, error } = await admin.rpc("reserve_steam_metadata_batch", { p_user_id: viewer.userId });
  const reserved = reservedGames.safeParse(data);
  if (error || !reserved.success) return failed;
  if (!reserved.data.length) return { message: "Aucune fiche Steam à enrichir pour le moment." };

  let enriched = 0;
  let retry = false;
  for (let offset = 0; offset < reserved.data.length; offset += 4) {
    const wave = await Promise.all(reserved.data.slice(offset, offset + 4).map(async (game) => {
      const metadata = await fetchSteamMetadata(game.external_id);
      if (metadata.status === "rate-limited" || metadata.status === "unavailable") return metadata.status;

      const { data, error } = await admin.rpc("save_steam_metadata", {
        p_game_id: game.game_id,
        p_reserved_until: game.reserved_until,
        p_description: metadata.status === "available" ? metadata.description : null,
        p_genres: metadata.status === "available" ? metadata.genres : [],
      });
      if (error || typeof data !== "boolean") return "unavailable";
      return data ? "enriched" : "unchanged";
    }));

    enriched += wave.filter((result) => result === "enriched").length;
    if (wave.includes("rate-limited")) {
      retry = true;
      break;
    }
    retry ||= wave.includes("unavailable");
  }

  if (enriched > 0) revalidatePath("/", "layout");
  if (enriched === 0 && retry) return failed;

  const summary = enriched === 1 ? "1 fiche enrichie." : enriched + " fiches enrichies.";
  return { message: retry ? summary + " Certaines fiches pourront être réessayées plus tard." : summary };
}
