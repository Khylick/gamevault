import "server-only";

import { z } from "zod";

import type { LibraryViewer } from "@/features/library/data";
import { createAdminClient } from "@/lib/supabase/admin";

import { advisorMatchesSchema, answerSchema, type AdvisorAnswer, type AdvisorIntent } from "./model";

const conversationSummary = z.object({
  id: z.uuid(),
  question: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});
const conversationSchema = conversationSummary.extend({ answer: answerSchema });

export async function advisorHasLibrary({ db, userId }: LibraryViewer) {
  const { data, error } = await db.from("user_games").select("game_id").eq("user_id", userId).limit(1);
  if (error) throw new Error("Impossible de vérifier la bibliothèque de l’assistant.");
  return Boolean(data?.length);
}

export async function listAdvisorHistory({ db, userId }: LibraryViewer) {
  const { data, error } = await db.from("ai_conversations").select("id,question,created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).order("id").limit(15);
  if (error) throw new Error("Impossible de lire l’historique de l’assistant.");
  return conversationSummary.array().parse(data ?? []);
}

export async function readAdvisorConversation({ db, userId }: LibraryViewer, id: string) {
  const { data, error } = await db.from("ai_conversations").select("id,question,created_at,answer")
    .eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw new Error("Impossible de lire cette réponse.");
  return data ? conversationSchema.parse(data) : null;
}

export async function findAdvisorMatches({ db }: LibraryViewer, intent: AdvisorIntent, durationMinutes: number | null) {
  if (intent === "completion" || intent === "unsupported") return { total: 0, games: [] };

  const { data, error } = await db.rpc("advisor_library_matches", { p_intent: intent, p_minutes: durationMinutes });
  if (error) throw new Error("Impossible de lire les jeux pour l’assistant.");
  return advisorMatchesSchema.parse(data);
}

export async function saveAdvisorConversation(
  admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, question: string, answer: AdvisorAnswer,
) {
  const { data, error } = await admin.from("ai_conversations").insert({ user_id: userId, question, answer })
    .select("id").single();
  const id = z.uuid().safeParse(data?.id);
  return error || !id.success ? null : id.data;
}
