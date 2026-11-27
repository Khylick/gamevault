"use client";

import { ArrowUpRight, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { GameCover } from "@/features/library/game-cover";
import { statusLabels } from "@/features/library/model";

import { tonightMoods, type TonightGame, type TonightMood, type TonightSuggestions } from "./tonight-model";

const moodLabels = {
  resume: "Reprendre un jeu",
  discover: "Découvrir un jeu",
  favorite: "Retrouver un favori",
} satisfies Record<TonightMood, string>;

const emptyMessages = {
  resume: "Marque un jeu « En pause » ou « En cours » pour le retrouver ici.",
  discover: "Les jeux encore à découvrir avec 0 min enregistrée et aucune dernière session apparaissent ici.",
  favorite: "Ajoute un jeu à tes favoris pour le retrouver ici.",
} satisfies Record<TonightMood, string>;

function suggestionReason(game: TonightGame, mood: TonightMood) {
  if (mood === "resume") {
    const status = game.status ? statusLabels[game.status] : "Dans ton backlog";
    return game.priority === null ? status : `${status} dans ton backlog · Priorité ${game.priority}/5`;
  }
  if (mood === "discover") {
    return game.status === "to_start" ? "À commencer dans ton backlog" : "Aucune session Steam enregistrée";
  }
  return game.rating === null ? "Dans tes favoris" : `Dans tes favoris · Tu lui as donné ${game.rating}/10`;
}

export function TonightPicks({ suggestions }: { suggestions: TonightSuggestions }) {
  const initialMood = tonightMoods.find((mood) => suggestions[mood]?.length) ?? "resume";
  const [selectedMood, setSelectedMood] = useState<TonightMood | null>(null);
  const mood = selectedMood ?? initialMood;
  const games = suggestions[mood];

  return (
    <section aria-labelledby="tonight-title">
      <Card className="p-5 sm:p-6">
        <h2 id="tonight-title" className="flex items-center gap-2 text-lg font-semibold">
          <Gamepad2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
          À quoi jouer ce soir ?
        </h2>
        <fieldset className="mt-4 flex flex-wrap gap-2">
          <legend className="sr-only">Ton envie du moment</legend>
          {tonightMoods.map((option) => (
            <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary">
              <input type="radio" name="tonight-mood" value={option} checked={mood === option}
                onChange={() => setSelectedMood(option)} className="size-4 shrink-0 accent-primary" />
              {moodLabels[option]}
            </label>
          ))}
        </fieldset>
        <div className="mt-4" aria-live="polite">
          {games?.length ? (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {games.map((game) => (
                <li key={game.game_id} className="min-w-0">
                  <Link href={"/library/" + game.game_id}
                    className="flex h-full min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-3 hover:border-primary/50 hover:bg-accent">
                    <GameCover game={game} className="aspect-[2/3] w-10 rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold wrap-anywhere">{game.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{suggestionReason(game, mood)}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {games === null ? "Les suggestions sont temporairement indisponibles pour cette envie." : emptyMessages[mood]}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}
