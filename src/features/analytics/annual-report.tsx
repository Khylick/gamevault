import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { formatPlaytime } from "@/features/dashboard/library-summary";
import { formatLibraryDate } from "@/features/library/model";

import type { AnnualLibraryReport } from "./data";

function ObservationDate({ value }: { value: string }) {
  return <time dateTime={value}>{formatLibraryDate(value)}</time>;
}

function GameRows<Game extends { id: string; title: string }>({ games, value }: {
  games: Game[];
  value: (game: Game) => ReactNode;
}) {
  return (
    <ul className="mt-3 divide-y divide-border">
      {games.map((game) => (
        <li key={game.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
          <Link href={"/library/" + game.id} className="min-w-0 flex-1 break-words font-medium hover:text-primary">{game.title}</Link>
          <span className="text-right text-muted-foreground tabular-nums">{value(game)}</span>
        </li>
      ))}
    </ul>
  );
}

export function AnnualReport({ report }: { report: AnnualLibraryReport }) {
  const { year, firstObservedOn, firstSampleOn, lastSampleOn, minutes, corrections, mostPlayed, completed, bestRated } = report;

  return (
    <>
      <Card className="p-5 sm:p-6">
        <form action="/analytics" className="mb-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value="annual" />
          <label className="grid gap-1.5 text-sm font-medium">
            Année du bilan
            <select name="year" defaultValue={year} className="library-field">
              {report.availableYears.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent">Afficher</button>
        </form>
        <h2 className="text-lg font-semibold">Temps de jeu observé en {year}</h2>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{minutes === null ? "Indisponible" : formatPlaytime(minutes)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {minutes === null
            ? "Deux relevés Steam d’un même jeu dans l’année sont nécessaires pour mesurer un écart."
            : "Le total additionne les écarts entre relevés d’un même jeu dans l’année, en UTC. La couverture peut être partielle."}
        </p>
        {firstSampleOn && lastSampleOn && (
          <p className="mt-1 text-sm text-muted-foreground">
            {firstSampleOn === lastSampleOn
              ? <>Relevés de l’année disponibles le <ObservationDate value={firstSampleOn} />.</>
              : <>Relevés de l’année du <ObservationDate value={firstSampleOn} /> au <ObservationDate value={lastSampleOn} />.</>}
          </p>
        )}
        {firstObservedOn && <p className="mt-1 text-sm text-muted-foreground">Historique Steam disponible depuis le <ObservationDate value={firstObservedOn} />.</p>}
        {corrections > 0 && <p className="mt-1 text-sm text-muted-foreground">Les baisses de compteur sont écartées du total.</p>}
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Jeux les plus joués</h2>
          {mostPlayed.length ? <GameRows games={mostPlayed} value={(game) => formatPlaytime(game.minutesPlayed)} />
            : <p className="mt-3 text-sm text-muted-foreground">Aucun temps de jeu positif mesuré pour cette année.</p>}
        </Card>
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Jeux terminés</h2>
          {completed.length ? <GameRows games={completed} value={(game) => <ObservationDate value={game.date} />} />
            : <p className="mt-3 text-sm text-muted-foreground">Aucun jeu marqué terminé avec une date de fin dans cette année.</p>}
        </Card>
      </div>
      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Tes meilleures notes</h2>
        {bestRated.length ? <GameRows games={bestRated} value={(game) => game.rating + " / 10"} />
          : <p className="mt-3 text-sm text-muted-foreground">Aucune note associée à cette année.</p>}
        <Link href={"/classements?year=" + year} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Voir le classement {year}
        </Link>
      </Card>
    </>
  );
}
