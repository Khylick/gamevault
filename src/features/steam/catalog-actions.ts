"use server";

import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/features/library/actions";
import { getLibraryViewer } from "@/features/library/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimExternalRequest } from "@/lib/supabase/external-requests";

import { processSteamMetadataBatch } from "./catalog-batch";

const failed = { message: "L’enrichissement des fiches est temporairement indisponible.", error: true };

export async function enrichSteamCatalog(): Promise<MutationResult> {
  const viewer = await getLibraryViewer(true);
  if (!viewer) return { message: "Reconnecte-toi à GameVault pour enrichir tes fiches Steam.", error: true };

  const admin = createAdminClient();
  if (!admin) return failed;
  const quota = await claimExternalRequest(admin, viewer.userId, "steam_metadata");
  if (quota === "limited") return { message: "Limite horaire d’enrichissement atteinte. Réessaie à l’heure suivante.", error: true };
  if (quota === "error") return failed;

  const batch = await processSteamMetadataBatch(admin, viewer.userId);
  if (!batch) return failed;
  if (!batch.reserved) return { message: "Aucune fiche Steam à enrichir pour le moment." };
  const { enriched, retry } = batch;

  if (enriched > 0) revalidatePath("/", "layout");
  else revalidatePath("/settings");
  if (enriched === 0 && retry) return failed;

  const summary = enriched === 1 ? "1 fiche enrichie." : enriched + " fiches enrichies.";
  return { message: retry ? summary + " Certaines fiches pourront être réessayées plus tard." : summary };
}
