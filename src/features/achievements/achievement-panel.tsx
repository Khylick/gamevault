"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatLibraryDate } from "@/features/library/model";

import { loadAchievements, type AchievementState } from "./actions";

const batchSize = 24;

export function AchievementPanel({ gameId }: { gameId: string }) {
  const [state, setState] = useState<AchievementState>(null);
  const [visible, setVisible] = useState(batchSize);
  const achievements = state && "achievements" in state ? state.achievements : null;
  const unlocked = achievements?.filter((achievement) => achievement.unlocked).length ?? 0;

  async function refresh() {
    const result = await loadAchievements(gameId).catch(() => ({ message: "Impossible de charger tes succès. Réessaie dans quelques instants." }));
    setVisible(batchSize);
    setState(result);
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-5 text-primary" aria-hidden="true" />
          Succès Steam
        </h2>
        <form action={refresh}>
          <SubmitButton label={state ? "Recharger mes succès" : "Charger mes succès"} pendingLabel="Chargement…" secondary />
        </form>
      </div>
      {state && "message" in state && <p role="status" className="mt-4 text-sm text-muted-foreground">{state.message}</p>}
      {achievements && (achievements.length > 0 ? (
        <>
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Débloqués parmi les succès renvoyés par Steam · {unlocked} / {achievements.length}
          </p>
          <ul className="mt-2 divide-y divide-border">
            {achievements.slice(0, visible).map((achievement) => (
              <li key={achievement.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-[1_1_14rem]">
                  <p className="break-words text-sm font-semibold">{achievement.title}</p>
                  {achievement.description && <p className="mt-1 break-words text-sm text-muted-foreground">{achievement.description}</p>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {achievement.unlocked ? "Débloqué" : "Verrouillé"}
                  {achievement.unlockedAt && (
                    <> · <time dateTime={achievement.unlockedAt}>{formatLibraryDate(achievement.unlockedAt)}</time></>
                  )}
                </p>
              </li>
            ))}
          </ul>
          {visible < achievements.length && (
            <button type="button" onClick={() => setVisible(visible + batchSize)} className="mt-2 min-h-11 text-sm font-medium text-primary hover:underline">
              Afficher plus de succès
            </button>
          )}
        </>
      ) : (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Steam n’a renvoyé aucun succès pour ce jeu.</p>
      ))}
    </Card>
  );
}
