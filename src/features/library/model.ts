import { z } from "zod";

export const gameStatus = z.enum(["to_discover", "to_start", "playing", "paused", "completed", "abandoned"]);
export type GameStatus = z.infer<typeof gameStatus>;

export const statusLabels = {
  to_discover: "À découvrir",
  to_start: "À commencer",
  playing: "En cours",
  paused: "En pause",
  completed: "Terminé",
  abandoned: "Abandonné",
} satisfies Record<GameStatus, string>;
export const pageSize = 24;

export type LibraryEntry = {
  game_id: string;
  name: string;
  platform: string;
  external_id: string;
  description: string | null;
  cover_url: string | null;
  genres: string[];
  favorite: boolean;
  playtime_minutes: number | null;
  recent_playtime_minutes: number | null;
  last_played_at: string | null;
  created_at: string;
  status: GameStatus | null;
  priority: number | null;
  goals: string | null;
  started_on: string | null;
  finished_on: string | null;
  rating: number | null;
  comment: string | null;
  rating_year?: number | null;
  steam_release_year?: number | null;
};

export type Collection = { id: string; name: string; description: string | null };

const filters = z.object({
  q: z.string().trim().max(100).catch(""),
  genre: z.string().trim().max(120).catch(""),
  status: z.union([gameStatus, z.literal("none"), z.literal("")]).catch(""),
  time: z.enum(["", "zero", "under10", "over10", "unknown"]).catch(""),
  favorite: z.enum(["", "1"]).catch(""),
  sort: z.enum(["name", "playtime", "added", "recent"]).catch("name"),
  view: z.enum(["grid", "list"]).catch("grid"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const parseLibraryQuery = (params: Record<string, unknown>) => filters.parse(params);
export type LibraryQuery = ReturnType<typeof parseLibraryQuery>;

export function pageHref(path: string, query: LibraryQuery, page: number) {
  const defaults = parseLibraryQuery({});
  const [pathname, search] = path.split("?", 2);
  const params = new URLSearchParams(search);

  for (const [key, value] of Object.entries({ ...query, page })) {
    if (value && value !== defaults[key as keyof LibraryQuery]) params.set(key, String(value));
  }

  return params.size > 0 ? pathname + "?" + params.toString() : pathname;
}

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export function formatLibraryDate(value: string) {
  return date.format(new Date(value));
}
