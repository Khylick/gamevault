import "server-only";

import { createSessionClient } from "@/lib/supabase/session";

import { pageSize, type Collection, type LibraryEntry, type LibraryQuery } from "./model";

export async function getLibraryViewer(writable = false) {
  const db = await createSessionClient(writable);
  if (!db) return null;

  const userId = writable
    ? (await db.auth.getUser()).data.user?.id
    : (await db.auth.getClaims()).data?.claims.sub;

  return userId ? { db, userId } : null;
}

export type LibraryViewer = NonNullable<Awaited<ReturnType<typeof getLibraryViewer>>>;

const sortColumns = { name: "name", playtime: "playtime_minutes", added: "created_at", recent: "last_played_at" };

export async function listLibrary(
  { db, userId }: LibraryViewer,
  query: LibraryQuery,
  options: { backlog?: boolean; collectionId?: string } = {},
) {
  const listing = db.from(options.collectionId ? "collection_library_entries" : "library_entries")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (options.collectionId) listing.eq("collection_id", options.collectionId);
  if (options.backlog) listing.not("status", "is", null);
  if (query.q) listing.ilike("name", "%" + query.q.replace(/[\\%_]/g, "\\$&") + "%");
  if (query.genre) listing.contains("genres", "{" + JSON.stringify(query.genre) + "}");
  if (query.status === "none") listing.is("status", null);
  else if (query.status) listing.eq("status", query.status);
  if (query.favorite) listing.eq("favorite", true);
  if (query.time === "zero") listing.eq("playtime_minutes", 0);
  if (query.time === "under10") listing.gt("playtime_minutes", 0).lt("playtime_minutes", 600);
  if (query.time === "over10") listing.gte("playtime_minutes", 600);
  if (query.time === "unknown") listing.is("playtime_minutes", null);

  const start = (query.page - 1) * pageSize;
  const { data, error, count } = await listing
    .order(sortColumns[query.sort], { ascending: query.sort === "name", nullsFirst: false })
    .order("game_id")
    .range(start, start + pageSize - 1)
    .overrideTypes<LibraryEntry[], { merge: false }>();
  if (error?.code === "PGRST103" && query.page > 1) return listLibrary({ db, userId }, { ...query, page: 1 }, options);
  if (error) throw new Error("Impossible de lire la bibliothèque.");
  return { entries: data ?? [], count: count ?? 0, page: query.page };
}

async function readAll<T>(
  fetchPage: (start: number, end: number) => PromiseLike<{
    data: T[] | null;
    error: { code: string } | null;
    count: number | null;
  }>,
  message: string,
) {
  const rows: T[] = [];
  const size = 500;

  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + size - 1);
    if (error?.code === "PGRST103" && rows.length > 0) return rows;
    if (error) throw new Error(message);
    if (!data?.length) return rows;
    rows.push(...data);
    if (rows.length >= (count ?? rows.length)) return rows;
  }
}

export async function listGenres({ db, userId }: LibraryViewer) {
  const rows = await readAll(
    (start, end) => db.from("library_genres").select("genre", { count: "exact" }).eq("user_id", userId)
      .order("genre").range(start, end).overrideTypes<{ genre: string }[], { merge: false }>(),
    "Impossible de lire les genres.",
  );
  return rows.map(({ genre }) => genre);
}

export async function readGame({ db, userId }: LibraryViewer, gameId: string) {
  const { data, error } = await db.from("library_entries").select("*").eq("user_id", userId)
    .eq("game_id", gameId).maybeSingle<LibraryEntry>();
  if (error) throw new Error("Impossible de lire ce jeu.");
  return data;
}

export async function readCollection({ db, userId }: LibraryViewer, id: string) {
  const { data, error } = await db.from("collections").select("id,name,description").eq("user_id", userId)
    .eq("id", id).maybeSingle<Collection>();
  if (error) throw new Error("Impossible de lire cette collection.");
  return data;
}

export function listCollections({ db, userId }: LibraryViewer) {
  return readAll(
    (start, end) => db.from("collections").select("id,name,description", { count: "exact" }).eq("user_id", userId)
      .order("name").order("id").range(start, end).overrideTypes<Collection[], { merge: false }>(),
    "Impossible de lire les collections.",
  );
}

export async function listMemberships({ db, userId }: LibraryViewer, gameId: string) {
  const rows = await readAll(
    (start, end) => db.from("collection_games").select("collection_id", { count: "exact" })
      .eq("user_id", userId).eq("game_id", gameId).order("collection_id").range(start, end)
      .overrideTypes<{ collection_id: string }[], { merge: false }>(),
    "Impossible de lire les collections de ce jeu.",
  );
  return new Set(rows.map(({ collection_id }) => collection_id));
}
