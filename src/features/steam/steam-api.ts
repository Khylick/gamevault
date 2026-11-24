import { z } from "zod";

const minutes = z.number().int().min(0).max(2_147_483_647);
const uint32 = z.number().int().min(0).max(4_294_967_295);

const gameSchema = z.object({
  appid: uint32.min(1),
  name: z.string().trim().max(512).optional(),
  playtime_forever: minutes.optional(),
  playtime_2weeks: minutes.optional(),
  rtime_last_played: uint32.optional(),
}).refine(
  (game) => game.playtime_forever === undefined
    || game.playtime_2weeks === undefined
    || game.playtime_2weeks <= game.playtime_forever,
);

const librarySchema = z.object({
  response: z.object({
    game_count: z.number().int().min(0).max(50_000).optional(),
    games: z.array(gameSchema).max(50_000).optional(),
  }),
});

type OwnedGame = {
  external_id: string;
  name: string | null;
  playtime_minutes: number | null;
  recent_playtime_minutes: number | null;
  last_played_at: string | null;
};

export type SteamLibraryResult =
  | { status: "available"; games: OwnedGame[] }
  | { status: "library-inaccessible" | "steam-rate-limit" | "steam-api-key" | "steam-invalid-library" | "steam-unavailable" };

export async function fetchOwnedGames(steamId: string, key: string, fetcher = fetch): Promise<SteamLibraryResult> {
  const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
  url.search = new URLSearchParams({
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    format: "json",
  }).toString();

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { "x-webapi-key": key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { status: "steam-unavailable" };
  }

  if (response.status === 429) return { status: "steam-rate-limit" };
  if (response.status === 401 || response.status === 403) return { status: "steam-api-key" };
  if (!response.ok) return { status: "steam-unavailable" };

  const json: unknown = await response.json().catch(() => null);
  const parsed = librarySchema.safeParse(json);
  if (!parsed.success) return { status: "steam-invalid-library" };

  const { game_count, games = [] } = parsed.data.response;
  if (game_count === undefined && games.length === 0) return { status: "library-inaccessible" };
  if (game_count !== games.length || new Set(games.map(({ appid }) => appid)).size !== games.length) {
    return { status: "steam-invalid-library" };
  }

  return {
    status: "available",
    games: games.map((game) => ({
      external_id: String(game.appid),
      name: game.name || null,
      playtime_minutes: game.playtime_forever ?? null,
      recent_playtime_minutes: game.playtime_2weeks ?? null,
      last_played_at: game.rtime_last_played ? new Date(game.rtime_last_played * 1000).toISOString() : null,
    })),
  };
}
