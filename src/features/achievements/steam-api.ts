import { z } from "zod";

const statsResponse = z.object({
  playerstats: z.discriminatedUnion("success", [
    z.object({ success: z.literal(false) }),
    z.object({
      success: z.literal(true),
      steamID: z.string().optional(),
      achievements: z.array(z.object({
        apiname: z.string().trim().min(1).max(512),
        name: z.string().trim().max(512).optional(),
        description: z.string().trim().max(4000).optional(),
        achieved: z.union([z.literal(0), z.literal(1)]),
        unlocktime: z.number().int().min(0).max(4_294_967_295).optional(),
      })).max(10_000).optional(),
    }),
  ]),
});

export type SteamAchievement = {
  id: string;
  title: string;
  description: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
};

type AchievementsResult =
  | { status: "available"; achievements: SteamAchievement[] }
  | { status: "inaccessible" | "rate-limited" | "unavailable" };

export async function fetchSteamAchievements(
  steamId: string, appId: string, key: string, fetcher = fetch,
): Promise<AchievementsResult> {
  const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/");
  url.search = new URLSearchParams({ steamid: steamId, appid: appId, l: "french", format: "json" }).toString();

  try {
    const response = await fetcher(url, {
      headers: { "x-webapi-key": key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6_000),
    });
    if (response.status === 429) return { status: "rate-limited" };

    const result = statsResponse.safeParse(await response.json());
    if (result.success && !result.data.playerstats.success && (response.ok || response.status === 400 || response.status === 403)) {
      return { status: "inaccessible" };
    }
    if (!response.ok || !result.success || !result.data.playerstats.success) return { status: "unavailable" };
    const { achievements, steamID } = result.data.playerstats;
    if (steamID !== undefined && steamID !== steamId) return { status: "unavailable" };
    if (!achievements || new Set(achievements.map(({ apiname }) => apiname)).size !== achievements.length) {
      return { status: "unavailable" };
    }

    return {
      status: "available",
      achievements: achievements.map(({ apiname, name, description, achieved, unlocktime }) => ({
        id: apiname,
        title: name || apiname,
        description: description || null,
        unlocked: achieved === 1,
        unlockedAt: achieved === 1 && unlocktime ? new Date(unlocktime * 1000).toISOString() : null,
      })),
    };
  } catch {
    return { status: "unavailable" };
  }
}
