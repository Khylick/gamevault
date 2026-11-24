"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getLibraryViewer, type LibraryViewer } from "./data";
import { gameStatus } from "./model";

export type MutationResult = { message: string; error?: boolean } | null;

const gameId = z.uuid();
const collectionId = z.uuid();
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const optionalNumber = (max: number) => z.union([z.literal(""), z.coerce.number().int().min(1).max(max)])
  .transform((value) => value === "" ? null : value);
const optionalDate = z.union([z.literal(""), z.iso.date()]).transform((value) => value || null);

function invalidateLibrary() {
  revalidatePath("/library");
  revalidatePath("/library/[id]", "page");
  revalidatePath("/backlog");
  revalidatePath("/collections");
  revalidatePath("/collections/[id]", "page");
}

async function mutate<T>(
  schema: z.ZodType<T>,
  form: FormData,
  write: (viewer: LibraryViewer, values: T) => PromiseLike<{ error: { code: string } | null }>,
  success: string,
  duplicate?: string,
): Promise<MutationResult> {
  const values = schema.safeParse(Object.fromEntries(form));
  if (!values.success) {
    return { message: values.error.issues[0]?.code === "custom"
      ? values.error.issues[0].message : "Vérifie les champs du formulaire.", error: true };
  }

  const viewer = await getLibraryViewer(true);
  if (!viewer) return { message: "Reconnecte-toi à GameVault pour enregistrer tes modifications.", error: true };

  const { error } = await write(viewer, values.data);
  if (error) return {
    message: error.code === "23505" && duplicate ? duplicate : "La modification n’a pas pu être enregistrée.",
    error: true,
  };

  invalidateLibrary();
  return { message: success };
}

export async function saveFavorite(_previous: MutationResult, form: FormData) {
  return mutate(z.object({ gameId, favorite: z.enum(["true", "false"]) }), form,
    ({ db, userId }, values) => db.from("user_games").update({ favorite: values.favorite === "true" })
      .eq("user_id", userId).eq("game_id", values.gameId).select("game_id").single(),
    "Liste de favoris actualisée.");
}

export async function saveStatus(_previous: MutationResult, form: FormData) {
  return mutate(z.object({ gameId, status: gameStatus }), form,
    ({ db }, values) => db.rpc("set_library_status", { p_game_id: values.gameId, p_status: values.status }),
    "Statut enregistré.");
}

const progressSchema = z.object({
  gameId, status: gameStatus, priority: optionalNumber(5), goals: optionalText(2000),
  startedOn: optionalDate, finishedOn: optionalDate,
}).refine(
  ({ startedOn, finishedOn }) => !startedOn || !finishedOn || startedOn <= finishedOn,
  { message: "La date de fin doit suivre la date de début." },
);

export async function saveProgress(_previous: MutationResult, form: FormData) {
  return mutate(progressSchema, form,
    ({ db }, values) => db.rpc("save_library_progress", {
      p_game_id: values.gameId, p_status: values.status, p_priority: values.priority, p_goals: values.goals,
      p_started_on: values.startedOn, p_finished_on: values.finishedOn,
    }),
    "Progression enregistrée.");
}

export async function saveReview(_previous: MutationResult, form: FormData) {
  return mutate(z.object({ gameId, rating: optionalNumber(10), comment: optionalText(3000) }), form,
    ({ db, userId }, values) => values.rating === null && values.comment === null
      ? db.from("user_reviews").delete().eq("user_id", userId).eq("game_id", values.gameId)
      : db.rpc("save_library_review", { p_game_id: values.gameId, p_rating: values.rating, p_comment: values.comment }),
    "Avis enregistré.");
}

const collectionFields = z.object({ name: z.string().trim().min(1).max(120), description: optionalText(1000) });
const duplicateCollection = "Tu as déjà une collection portant ce nom.";

export async function createCollection(_previous: MutationResult, form: FormData) {
  return mutate(collectionFields, form,
    ({ db, userId }, values) => db.from("collections").insert({ user_id: userId, ...values }),
    "Collection créée.", duplicateCollection);
}

export async function updateCollection(_previous: MutationResult, form: FormData) {
  return mutate(collectionFields.extend({ collectionId }), form,
    ({ db, userId }, { collectionId, ...values }) => db.from("collections").update(values)
      .eq("user_id", userId).eq("id", collectionId).select("id").single(),
    "Collection actualisée.", duplicateCollection);
}

export async function deleteCollection(_previous: MutationResult, form: FormData) {
  const result = await mutate(z.object({ collectionId }), form,
    ({ db, userId }, values) => db.from("collections").delete().eq("user_id", userId)
      .eq("id", values.collectionId).select("id").single(),
    "Collection supprimée.");
  if (result?.error) return result;
  redirect("/collections");
}

export async function updateMembership(_previous: MutationResult, form: FormData) {
  return mutate(z.object({ gameId, collectionId, membership: z.enum(["add", "remove"]) }), form,
    async ({ db, userId }, values) => {
      if (values.membership === "remove") {
        return db.from("collection_games").delete()
          .eq("user_id", userId).eq("collection_id", values.collectionId).eq("game_id", values.gameId);
      }

      const result = await db.from("collection_games").insert({
        user_id: userId, collection_id: values.collectionId, game_id: values.gameId,
      });
      return { error: result.error?.code === "23505" ? null : result.error };
    },
    "Collection actualisée.");
}
