import type { LibraryEntry } from "@/features/library/model";

export const tonightMoods = ["resume", "discover", "favorite"] as const;
export type TonightMood = (typeof tonightMoods)[number];

export type TonightGame = Pick<LibraryEntry,
  "game_id" | "name" | "platform" | "external_id" | "cover_url" | "status" | "priority" | "rating">;

export type TonightSuggestions = Record<TonightMood, TonightGame[] | null>;
