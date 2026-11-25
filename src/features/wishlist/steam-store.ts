import { z } from "zod";

const appId = z.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 4_294_967_295);
const storeApp = z.object({ appid: z.number().int(), name: z.string().trim().min(1).max(512) });
const storeList = z.object({ response: z.object({ apps: z.array(storeApp).default([]) }) });

export function parseSteamAppId(input: FormDataEntryValue | null) {
  if (typeof input !== "string" || input.length > 512) return null;

  const value = input.trim();
  let candidate = value;
  if (URL.canParse(value)) {
    const url = new URL(value);
    if (url.origin !== "https://store.steampowered.com" || url.username || url.password) return null;
    candidate = /^\/app\/([1-9]\d{0,9})(?:\/|$)/.exec(url.pathname)?.[1] ?? "";
  }

  const parsed = appId.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

type StoreResult = { status: "found"; name: string } | { status: "not-found" | "unavailable" };

export async function findSteamStoreGame(id: string, key: string, fetcher = fetch): Promise<StoreResult> {
  const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
  url.searchParams.set("input_json", JSON.stringify({ last_appid: Number(id) - 1, max_results: 1, include_games: true }));

  try {
    const response = await fetcher(url, {
      headers: { "x-webapi-key": key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { status: "unavailable" };
    const result = storeList.safeParse(await response.json());
    if (!result.success) return { status: "unavailable" };
    const game = result.data.response.apps[0];
    return game?.appid === Number(id) ? { status: "found", name: game.name } : { status: "not-found" };
  } catch {
    return { status: "unavailable" };
  }
}
