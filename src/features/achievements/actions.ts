"use server";

import { z } from "zod";

import { getLibraryViewer, readGame } from "@/features/library/data";
import { getSteamAccount } from "@/features/steam/steam-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimExternalRequest } from "@/lib/supabase/external-requests";

import { fetchSteamAchievements, type SteamAchievement } from "./steam-api";

export type AchievementState = { achievements: SteamAchievement[] } | { message: string } | null;

const unavailable = { message: "Les succès Steam sont temporairement indisponibles. Réessaie plus tard." };

export async function loadAchievements(gameId: string): Promise<AchievementState> {
  const id = z.uuid().safeParse(gameId);
  if (!id.success) return { message: "Ce jeu est indisponible." };
  const viewer = await getLibraryViewer(true);
  if (!viewer) return { message: "Reconnecte-toi à GameVault pour consulter tes succès." };

  const [game, steam] = await Promise.all([
    readGame(viewer, id.data).catch(() => null),
    getSteamAccount(viewer.db, viewer.userId),
  ]);
  if (!game || game.platform !== "steam" || !/^[1-9]\d{0,9}$/.test(game.external_id)
    || Number(game.external_id) > 4_294_967_295) return { message: "Ce jeu Steam est indisponible dans ta bibliothèque." };
  if (steam.error) return unavailable;
  if (!steam.data) return { message: "Associe ton compte Steam dans les paramètres pour consulter tes succès." };

  const key = process.env.STEAM_WEB_API_KEY?.trim();
  const admin = createAdminClient();
  if (!key || !admin) return { message: "La consultation des succès Steam est indisponible sur ce déploiement." };

  const quota = await claimExternalRequest(admin, viewer.userId, "steam_achievements");
  if (quota === "limited") return { message: "Limite horaire de consultations atteinte. Réessaie à l’heure suivante." };
  if (quota === "error") return unavailable;

  const result = await fetchSteamAchievements(steam.data.steam_id, game.external_id, key);
  switch (result.status) {
    case "available":
      return { achievements: result.achievements };
    case "inaccessible":
      return { message: "Steam ne fournit pas les succès de ce jeu pour ton compte. Vérifie la visibilité des détails de jeu dans ton profil Steam." };
    case "rate-limited":
      return { message: "Steam limite les requêtes. Réessaie dans quelques minutes." };
    default:
      return unavailable;
  }
}
