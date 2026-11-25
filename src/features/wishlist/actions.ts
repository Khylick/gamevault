"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { MutationResult } from "@/features/library/actions";
import { getLibraryViewer } from "@/features/library/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimExternalRequest } from "@/lib/supabase/external-requests";

import { findSteamStoreGame, parseSteamAppId } from "./steam-store";

const sessionRequired = "Reconnecte-toi à GameVault pour modifier ta wishlist.";
const saveFailed = "Le jeu n’a pas pu être ajouté. Réessaie dans quelques instants.";

export async function addWish(_previous: MutationResult, form: FormData): Promise<MutationResult> {
  const appId = parseSteamAppId(form.get("steamApp"));
  if (!appId) return { message: "Saisis un lien vers une fiche Steam ou un AppID valide.", error: true };

  const viewer = await getLibraryViewer(true);
  if (!viewer) return { message: sessionRequired, error: true };
  const admin = createAdminClient();
  if (!admin) return { message: "L’ajout de jeux à la wishlist est indisponible.", error: true };

  const catalog = await viewer.db.from("games").select("id").eq("platform", "steam").eq("external_id", appId).maybeSingle();
  if (catalog.error) return { message: saveFailed, error: true };

  let name: string | null = null;
  if (!catalog.data) {
    const key = process.env.STEAM_WEB_API_KEY?.trim();
    if (!key) return { message: "La recherche de nouveaux jeux Steam est indisponible.", error: true };

    const quota = await claimExternalRequest(admin, viewer.userId, "steam_wishlist");
    if (quota === "limited") return { message: "Limite horaire de recherches Steam atteinte. Réessaie à l’heure suivante.", error: true };
    if (quota === "error") return { message: saveFailed, error: true };

    const result = await findSteamStoreGame(appId, key);
    if (result.status !== "found") return {
      message: result.status === "not-found" ? "Ce jeu est introuvable dans le catalogue Steam."
        : "Le catalogue Steam est indisponible. Réessaie dans quelques instants.",
      error: true,
    };
    name = result.name;
  }

  const { error, data } = await admin.rpc("save_steam_wish", {
    p_user_id: viewer.userId, p_app_id: appId, p_name: name,
  });
  if (error || data !== true) return { message: saveFailed, error: true };

  revalidatePath("/wishlist");
  return { message: "Le jeu est dans ta wishlist." };
}

export async function removeWish(_previous: MutationResult, form: FormData): Promise<MutationResult> {
  const id = z.uuid().safeParse(form.get("gameId"));
  if (!id.success) return { message: "Le jeu sélectionné est invalide.", error: true };

  const viewer = await getLibraryViewer(true);
  if (!viewer) return { message: sessionRequired, error: true };

  const { error } = await viewer.db.from("wishlist").delete().eq("user_id", viewer.userId).eq("game_id", id.data);
  if (error) return { message: "Le jeu n’a pas pu être retiré. Réessaie dans quelques instants.", error: true };

  revalidatePath("/wishlist");
  return { message: "Jeu retiré de ta wishlist." };
}
