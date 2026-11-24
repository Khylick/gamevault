import Link from "next/link";

import { Card } from "@/components/ui/card";
import { MostPlayed } from "@/features/dashboard/dashboard-activity";
import { formatCount, formatPlayDate, formatPlaytime } from "@/features/dashboard/library-summary";
import { formatLibraryDate, gameStatus, statusLabels } from "@/features/library/model";
import { cn } from "@/lib/utils";

import { AnalyticsBarChart, type ChartPoint } from "./bar-chart";
import type { AnalyticsPeriod, AnalyticsReport } from "./data";

const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });

function Values({ points, unit = "minutes" }: { points: ChartPoint[]; unit?: "minutes" | "games" }) {
  return (
    <details className="mt-3 border-t border-border pt-3 text-sm">
      <summary className="cursor-pointer font-medium text-primary">Voir les valeurs</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">Valeurs du graphique</caption>
        <thead><tr><th scope="col" className="py-2">Libellé</th><th scope="col" className="py-2 text-right">Valeur</th></tr></thead>
        <tbody className="divide-y divide-border">
          {points.map(({ label, value }) => (
            <tr key={label}>
              <th scope="row" className="py-2 pr-3 font-normal">{label}</th>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {value === null ? "Indisponible" : unit === "minutes" ? formatPlaytime(value) : formatCount(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function HistoryChart({ history, period }: { history: AnalyticsReport["history"]; period: AnalyticsPeriod }) {
  const points = history.map((row) => ({
    label: period === "week" ? formatPlayDate(row.period_start) : monthLabel.format(new Date(row.period_start)),
    value: row.minutes,
  }));
  const unallocated = history.reduce((sum, row) => sum + row.unallocated_minutes, 0);
  const corrections = history.reduce((sum, row) => sum + row.corrections, 0);
  const measured = history.some(({ intervals }) => intervals > 0);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Temps de jeu par {period === "week" ? "semaine" : "mois"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Écarts mesurés entre deux relevés d’une même période UTC. Les périodes sans mesure restent vides et la couverture peut être partielle.
          </p>
        </div>
        <nav aria-label="Période du graphique" className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
          {([{ value: "week", label: "Semaines", href: "/analytics" }, { value: "month", label: "Mois", href: "/analytics?period=month" }] as const).map(({ value, label, href }) => (
            <Link key={value} href={href} aria-current={period === value ? "page" : undefined}
              className={cn("rounded-md px-3 py-1.5 text-sm", period === value ? "bg-accent font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {measured ? (
        <div className="mt-4">
          <AnalyticsBarChart points={points} name="Temps mesuré" />
          <Values points={points} />
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Historique insuffisant. Deux relevés d’un même jeu dans une période permettent de mesurer un écart.
        </p>
      )}
      {unallocated > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {formatPlaytime(unallocated)} restent sans période attribuable, car les relevés traversent plusieurs périodes.
        </p>
      )}
      {corrections > 0 && <p className="mt-2 text-sm text-muted-foreground">Les baisses de compteur ont été écartées du graphique.</p>}
    </Card>
  );
}

function GenreChart({ details }: { details: AnalyticsReport["details"] }) {
  const points = details.genreMinutes.map(({ label, minutes }) => ({ label, value: minutes }));

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Temps de jeu par genre</h2>
      {points.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Genres renseignés pour {formatPlaytime(details.taggedMinutes)}. Un jeu contribue à chacun de ses genres.
          </p>
          <div className="mt-4"><AnalyticsBarChart points={points} name="Temps de jeu connu" layout="vertical" /></div>
          <Values points={points} />
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Aucun temps de jeu connu associé à un genre du catalogue.</p>
      )}
    </Card>
  );
}

function BacklogChart({ counts }: { counts: AnalyticsReport["details"]["backlogCounts"] }) {
  const points = gameStatus.options.map((status) => ({ label: statusLabels[status], value: counts[status] ?? 0 }));

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Progression du backlog</h2>
      {points.some(({ value }) => value > 0) ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Répartition actuelle des jeux avec un statut.</p>
          <div className="mt-4"><AnalyticsBarChart points={points} name="Jeux" layout="vertical" unit="games" /></div>
          <Values points={points} unit="games" />
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Attribue un statut depuis la fiche d’un jeu pour suivre sa progression.</p>
      )}
    </Card>
  );
}

function DatedGames({ title, description, games, empty }: {
  title: string;
  description: string;
  games: AnalyticsReport["details"]["recentAdditions"];
  empty: string;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {games.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {games.map(({ id, title, date }) => (
            <li key={id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <Link href={"/library/" + id} className="min-w-0 break-words font-medium hover:text-primary">{title}</Link>
              <time dateTime={date} className="shrink-0 text-muted-foreground">{formatLibraryDate(date)}</time>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-muted-foreground">{empty}</p>}
    </Card>
  );
}

export function Analytics({ report, period }: { report: AnalyticsReport; period: AnalyticsPeriod }) {
  const { summary, details, history } = report;

  return (
    <>
      <HistoryChart history={history} period={period} />
      <div className="grid gap-4 lg:grid-cols-2">
        <GenreChart details={details} />
        <BacklogChart counts={details.backlogCounts} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <MostPlayed summary={summary} />
        <div className="grid gap-4">
          <DatedGames title="Derniers jeux ajoutés" description="Date d’ajout dans GameVault."
            games={details.recentAdditions} empty="Aucun jeu ajouté." />
          <DatedGames title="Jeux délaissés" description="Dernière session connue il y a plus de 90 jours."
            games={details.inactiveGames} empty="Aucun jeu ne répond à ce critère." />
        </div>
      </div>
    </>
  );
}
