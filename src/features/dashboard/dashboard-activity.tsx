import { ChartNoAxesColumnIncreasing, Gamepad2, History } from "lucide-react";
import Image from "next/image";

import { Card } from "@/components/ui/card";

import { formatPlayDate, formatPlaytime, type LibrarySummary } from "./library-summary";

function RecentlyPlayed({ games }: { games: LibrarySummary["recentlyPlayed"] }) {
  return (
    <section id="jeux-recents" tabIndex={-1} aria-labelledby="recently-played-title" className="min-w-0 scroll-mt-6 rounded-xl">
      <Card className="h-full p-5 sm:p-6">
        <h2 id="recently-played-title" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <History className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
          Joués récemment
        </h2>
        {games.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {games.map((game) => (
              <li key={game.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0 sm:gap-4">
                <div className="relative aspect-video w-17 shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-23">
                  {game.cover ? (
                    <Image src={game.cover} alt="" fill sizes="(min-width: 640px) 92px, 68px" className="object-cover object-right" />
                  ) : (
                    <span className="grid h-full place-items-center text-primary">
                      <Gamepad2 className="size-5" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{game.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{game.genre}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">{formatPlaytime(game.minutesPlayed)}</p>
                  <time dateTime={game.lastPlayedOn} className="text-xs text-muted-foreground">
                    {formatPlayDate(game.lastPlayedOn)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aucune session de jeu disponible.</p>
        )}
      </Card>
    </section>
  );
}

const shareFormatter = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

function MostPlayed({ summary }: { summary: LibrarySummary }) {
  const { mostPlayed, otherMinutes, minutesPlayed } = summary;

  return (
    <section aria-labelledby="most-played-title" className="min-w-0">
      <Card className="h-full p-5 sm:p-6">
        <h2 id="most-played-title" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <ChartNoAxesColumnIncreasing className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
          Top 5 des jeux les plus joués
        </h2>
        {mostPlayed.length > 0 ? (
          <>
            <p className="mt-1.5 text-sm text-muted-foreground">Part du temps de jeu total</p>
            <ol className="mt-4 space-y-3">
              {mostPlayed.map((game) => {
                const share = game.minutesPlayed / minutesPlayed;

                return (
                  <li key={game.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{game.title}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatPlaytime(game.minutesPlayed)}
                        <span className="sr-only">, {shareFormatter.format(share)} du temps total</span>
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-linear-to-r from-violet-600 to-primary" style={{ width: share * 100 + "%" }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            {otherMinutes > 0 && (
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                Autres jeux · {formatPlaytime(otherMinutes)} ({shareFormatter.format(otherMinutes / minutesPlayed)})
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aucun temps de jeu disponible.</p>
        )}
      </Card>
    </section>
  );
}

export function DashboardActivity({ summary }: { summary: LibrarySummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <RecentlyPlayed games={summary.recentlyPlayed} />
      <MostPlayed summary={summary} />
    </div>
  );
}
