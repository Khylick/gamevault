"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getLibraryViewer } from "@/features/library/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimExternalRequest } from "@/lib/supabase/external-requests";

import { advisorHasLibrary, findAdvisorMatches, saveAdvisorConversation } from "./data";
import { questionSchema, resolveDuration } from "./model";
import { advisorProviderConfig, interpretAdvisorQuestion } from "./openai";

export type AdvisorState = { message: string; error: true } | null;

const problem = (message: string): AdvisorState => ({ message, error: true });
const readError = "GameVault n’a pas pu préparer cette réponse. Réessaie dans quelques instants.";

export async function askAdvisor(_previous: AdvisorState, form: FormData): Promise<AdvisorState> {
  const question = questionSchema.safeParse(form.get("question"));
  if (!question.success) return problem("Écris une question de 2 à 500 caractères.");

  const viewer = await getLibraryViewer(true);
  if (!viewer) return problem("Reconnecte-toi à GameVault pour poser une question.");
  const provider = advisorProviderConfig();
  const admin = createAdminClient();
  if (!provider || !admin) return problem("Game Advisor nécessite une configuration serveur.");

  let id: string | null;
  try {
    if (!(await advisorHasLibrary(viewer))) return problem("Synchronise ta bibliothèque avant de poser une question.");
    const quota = await claimExternalRequest(admin, viewer.userId, "advisor");
    if (quota === "limited") return problem("Tu as atteint la limite horaire de Game Advisor. Réessaie à l’heure suivante.");
    if (quota === "error") return problem(readError);

    const result = await interpretAdvisorQuestion(provider, question.data);
    if (result.status === "rate-limited") return problem("Le service IA limite les demandes. Réessaie dans quelques instants.");
    if (result.status === "unavailable") return problem("Le service IA est indisponible. Réessaie dans quelques instants.");
    if (result.status !== "ok") return problem("Le service IA a renvoyé une réponse inexploitable. Reformule ta question.");

    const { interpretation } = result;
    const durationMinutes = resolveDuration(question.data, interpretation);
    if (durationMinutes === "ambiguous") {
      return problem(interpretation.intent === "abandoned"
        ? "Indique un seul seuil en chiffres, par exemple « abandonnés après moins de 5 heures »."
        : "Indique une seule durée en chiffres, par exemple 45 min ou 1 h 30.");
    }

    const matches = await findAdvisorMatches(viewer, interpretation.intent, durationMinutes);
    id = await saveAdvisorConversation(admin, viewer.userId, question.data, { intent: interpretation.intent, durationMinutes, matches });
  } catch {
    return problem(readError);
  }

  if (!id) return problem("La réponse n’a pas pu être enregistrée. Réessaie dans quelques instants.");
  revalidatePath("/game-advisor");
  redirect("/game-advisor?conversation=" + id);
}

export async function deleteAdvisorConversation(_previous: unknown, form: FormData): Promise<AdvisorState> {
  const id = z.uuid().safeParse(form.get("conversationId"));
  const viewer = await getLibraryViewer(true);
  if (!id.success || !viewer) return problem("Cette réponse est indisponible.");

  const { error } = await viewer.db.from("ai_conversations").delete()
    .eq("user_id", viewer.userId).eq("id", id.data).select("id").single();
  if (error) return problem("Cette réponse n’a pas pu être supprimée.");

  revalidatePath("/game-advisor");
  redirect("/game-advisor");
}
