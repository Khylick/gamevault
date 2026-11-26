import { Gamepad2 } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCount, formatPlaytime } from "@/features/dashboard/library-summary";
import { StatusLabel } from "@/features/library/library-ui";
import { MutationForm } from "@/features/library/mutation-form";

import { deleteAdvisorConversation } from "./actions";
import type { AdvisorAnswer as Answer } from "./model";

const answerTitles = {
  session: "À quoi jouer",
  relaxing: "Pistes pour une partie tranquille",
  unplayed: "Jeux sans temps de jeu enregistré",
  abandoned: "Jeux marqués abandonnés",
  completion: "Durées de complétion indisponibles",
  similar: "Des genres en commun avec tes favoris",
  resume: "Jeux à reprendre dans ton backlog",
  similar_rated: "Jeux proches de tes meilleures notes",
  unsupported: "Ce que Game Advisor peut chercher",
};

function describe({ intent, durationMinutes }: Answer) {
  const duration = durationMinutes === null ? null : formatPlaytime(durationMinutes);
  switch (intent) {
    case "session":
      return duration
        ? "Pour tes " + duration + " disponibles, voici des pistes fondées sur tes favoris, ta progression et tes notes. Les durées de session sont inconnues."
        : "Le classement privilégie tes favoris, tes jeux en cours et tes notes.";
    case "relaxing":
      return "Ces pistes s’appuient sur les genres renseignés dans le catalogue. L’ambiance ressentie peut varier.";
    case "unplayed":
      return "Ces jeux ont 0 minute enregistrée et aucune dernière session renseignée.";
    case "abandoned":
      return duration
        ? "Jeux marqués abandonnés avec un temps de jeu connu inférieur à " + duration + "."
        : "Jeux dont tu as marqué le statut comme abandonné.";
    case "completion":
      return "GameVault reçoit le temps de jeu cumulé lorsque Steam le fournit. La durée nécessaire pour terminer un jeu reste inconnue.";
    case "similar":
      return "Le classement utilise les genres du catalogue que ces jeux partagent avec tes favoris.";
    case "resume":
      return "Ces jeux sont en cours ou en pause. Les genres en commun avec tes favoris et tes jeux notés 8/10 ou plus servent à les départager.";
    case "similar_rated":
      return "Ces jeux partagent des genres avec les titres auxquels tu as donné ta meilleure note.";
    case "unsupported":
      return "Demande une suggestion dans ta bibliothèque, un jeu à reprendre ou un jeu proche de tes favoris ou de tes meilleures notes.";
  }
}

function emptyMatches(intent: Answer["intent"]) {
  if (intent === "similar") return "Aucun jeu avec un genre en commun. Les genres doivent être renseignés pour tes favoris et pour les jeux comparés.";
  if (intent === "resume") return "Aucun jeu en cours ou en pause dans ton backlog.";
  if (intent === "similar_rated") return "Aucun jeu comparable trouvé. Game Advisor a besoin de notes et de genres renseignés pour établir un rapprochement.";
  if (intent === "relaxing") return "Aucun jeu ne correspond aux genres de détente disponibles dans ta bibliothèque.";
  return "Aucun jeu ne correspond à cette demande.";
}

export function AdvisorAnswer({ id, question, answer }: { id: string; question: string; answer: Answer }) {
  const { matches, intent } = answer;
  const hasMatches = intent !== "completion" && intent !== "unsupported";

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <p className="break-words rounded-lg border border-primary/20 bg-primary/8 px-3 py-2 text-sm text-foreground">{question}</p>
      <h2 className="mt-5 text-lg font-semibold">{answerTitles[intent]}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{describe(answer)}</p>
      {hasMatches && matches.total === 0 && <p className="mt-4 text-sm">{emptyMatches(intent)}</p>}
      {matches.games.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-border">
            {matches.games.map((game) => (
              <li key={game.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-background text-primary">
                  <Gamepad2 className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <Link href={"/library/" + game.id} className="break-words text-sm font-semibold hover:text-primary">{game.title}</Link>
                  {game.matchedGenres.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{game.matchedGenres.join(" · ")}</p>}
                  {intent === "resume" && (game.status === "playing" || game.status === "paused") && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusLabel status={game.status} />
                      {game.rating != null && <span>Ta note · {game.rating}/10</span>}
                      {game.favorite && <span>Dans tes favoris</span>}
                    </div>
                  )}
                  {intent === "resume" && game.favoriteGenreMatch && (
                    <p className="mt-1 text-xs text-muted-foreground">Genre en commun avec tes favoris</p>
                  )}
                  {game.ratedReferences.length > 0 && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      Genres en commun avec {game.ratedReferences.map((reference) => reference.title + " (" + reference.rating + "/10)").join(", ")}
                    </p>
                  )}
                  {intent === "session" && (game.favorite || game.status === "playing") && (
                    <p className="mt-1 text-xs text-muted-foreground">{game.favorite ? "Dans tes favoris" : "En cours"}</p>
                  )}
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">
                  {game.minutesPlayed === null ? "Temps indisponible" : formatPlaytime(game.minutesPlayed) + " jouées"}
                </p>
              </li>
            ))}
          </ul>
          {matches.total > matches.games.length && (
            <p className="mt-2 text-sm text-muted-foreground">{formatCount(matches.games.length)} résultats affichés sur {formatCount(matches.total)}.</p>
          )}
        </>
      )}
      <MutationForm action={deleteAdvisorConversation} className="mt-4 border-t border-border pt-4">
        <input type="hidden" name="conversationId" value={id} />
        <SubmitButton label="Supprimer cette réponse" pendingLabel="Suppression…" secondary />
      </MutationForm>
    </Card>
  );
}
