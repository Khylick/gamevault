import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { claimExternalRequest } from "@/lib/supabase/external-requests";
import type { createSessionClient } from "@/lib/supabase/session";

import { fetchOwnedGames } from "./steam-api";

type SessionClient = NonNullable<Awaited<ReturnType<typeof createSessionClient>>>;
type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function issueSteamChallenge(admin: AdminClient, userId: string) {
  const state = randomBytes(32).toString("hex");
  const { error } = await admin.rpc("issue_steam_link_challenge", {
    p_user_id: userId,
    p_token_hash: hashState(state),
  });

  return error ? null : state;
}

export async function completeSteamLink(admin: AdminClient, userId: string, state: string, steamId: string) {
  const { data, error } = await admin.rpc("complete_steam_link", {
    p_user_id: userId,
    p_token_hash: hashState(state),
    p_steam_id: steamId,
  });

  if (error) return "service-error";
  if (data === "linked") return "linked";
  if (data === "expired") return "steam-expired";
  if (data === "conflict") return "steam-conflict";
  return "service-error";
}

export async function getSteamAccount(supabase: SessionClient, userId: string) {
  return supabase.from("steam_accounts")
    .select("steam_id,last_synced_at")
    .eq("user_id", userId)
    .maybeSingle<{ steam_id: string; last_synced_at: string | null }>();
}

export function hasSteamApiKey() {
  return Boolean(process.env.STEAM_WEB_API_KEY?.trim());
}

export async function synchronizeSteamLibrary(admin: AdminClient, userId: string, steamId: string) {
  const key = process.env.STEAM_WEB_API_KEY?.trim();
  if (!key) return "steam-api-key";
  const quota = await claimExternalRequest(admin, userId, "steam_sync");
  if (quota === "limited") return "sync-rate-limit";
  if (quota === "error") return "service-error";

  const observedAt = new Date().toISOString();
  const library = await fetchOwnedGames(steamId, key);
  if (library.status !== "available") return library.status;

  const { data, error } = await admin.rpc("sync_steam_library", {
    p_user_id: userId,
    p_steam_id: steamId,
    p_observed_at: observedAt,
    p_games: library.games,
  });

  if (error) return "service-error";
  if (data === "synced") return library.games.length > 0 ? "steam-synced" : "steam-empty";
  if (data === "outdated") return "steam-outdated";
  if (data === "missing") return "steam-not-linked";
  return "service-error";
}
