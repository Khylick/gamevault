import { z } from "zod";

const detailsSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(false) }),
  z.object({
    success: z.literal(true),
    data: z.object({
      steam_appid: z.number().int(),
      short_description: z.string().max(4000).optional(),
      genres: z.array(z.object({ description: z.string().trim().min(1).max(120) })).max(100).optional(),
      release_date: z.object({ coming_soon: z.boolean(), date: z.string().max(120) }).optional().catch(undefined),
    }),
  }),
]);

type SteamMetadataResult =
  | { status: "available"; description: string | null; genres: string[]; releaseYear: number | null }
  | { status: "missing" | "rate-limited" | "unavailable" };

const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

function plainText(description: string) {
  return description.replace(/<br\s*\/?>|<\/p\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|quot|apos|lt|gt|nbsp|#[0-9]{1,7}|#x[\da-f]{1,6});/gi, (entity, encoded: string) => {
      const code = encoded.toLowerCase();
      if (!code.startsWith("#")) return entities[code] ?? entity;
      const point = code.startsWith("#x") ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff)
        ? String.fromCodePoint(point) : entity;
    })
    .replace(/\s+/g, " ").trim() || null;
}

export async function fetchSteamMetadata(appId: string, fetcher = fetch): Promise<SteamMetadataResult> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.search = new URLSearchParams({ appids: appId, l: "french" }).toString();

  try {
    const response = await fetcher(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4_000) });
    if (response.status === 429) return { status: "rate-limited" };
    if (!response.ok) return { status: "unavailable" };
    const payload: Record<string, unknown> | null = await response.json();
    const parsed = detailsSchema.safeParse(payload?.[appId]);
    if (!parsed.success) return { status: "unavailable" };
    if (!parsed.data.success) return { status: "missing" };
    const data = parsed.data.data;
    if (String(data.steam_appid) !== appId) return { status: "unavailable" };
    const years = data.release_date?.coming_soon === false
      ? data.release_date.date.match(/\b(?:19\d{2}|20\d{2}|2100)\b/g) : null;

    return {
      status: "available",
      description: data.short_description ? plainText(data.short_description) : null,
      genres: [...new Set(data.genres?.map((genre) => genre.description))],
      releaseYear: years?.length === 1 ? Number(years[0]) : null,
    };
  } catch {
    return { status: "unavailable" };
  }
}
