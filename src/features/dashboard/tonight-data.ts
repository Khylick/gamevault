import "server-only";

import type { LibraryViewer } from "@/features/library/data";

import type { TonightGame, TonightSuggestions } from "./tonight-model";

export async function readTonightSuggestions({ db, userId }: LibraryViewer): Promise<TonightSuggestions> {
  const candidates = () => db.from("library_entries")
    .select("game_id,name,platform,external_id,cover_url,status,priority,rating").eq("user_id", userId);

  const [resume, discover, favorite] = await Promise.all([
    candidates().in("status", ["paused", "playing"])
      .order("status").order("priority", { ascending: false, nullsFirst: false })
      .order("last_played_at", { ascending: false, nullsFirst: false })
      .order("name").order("game_id").limit(3).overrideTypes<TonightGame[], { merge: false }>(),
    candidates().eq("playtime_minutes", 0).is("last_played_at", null)
      .or("status.is.null,status.in.(to_discover,to_start)")
      .order("priority", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
      .order("name").order("game_id").limit(3).overrideTypes<TonightGame[], { merge: false }>(),
    candidates().eq("favorite", true).or("status.is.null,status.neq.abandoned")
      .order("rating", { ascending: false, nullsFirst: false }).order("last_played_at", { ascending: false, nullsFirst: false })
      .order("name").order("game_id").limit(3).overrideTypes<TonightGame[], { merge: false }>(),
  ]);

  return { resume: resume.data, discover: discover.data, favorite: favorite.data };
}
