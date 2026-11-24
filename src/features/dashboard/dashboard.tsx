import { Cable, History, LibraryBig } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { GameCover } from "@/features/library/game-cover";

import { DashboardActivity } from "./dashboard-activity";
import { DashboardMetrics } from "./dashboard-metrics";
import { formatPlayDate, type LibrarySummary } from "./library-summary";

function DashboardHero({ game }: { game?: LibrarySummary["recentlyPlayed"][number] }) {
  return (
    <Card className="relative isolate flex min-h-63 items-center overflow-hidden border-violet-400/25 bg-[#171326]">
      {game?.artwork ? (
        <GameCover game={game.artwork} className="absolute inset-y-0 right-0 -z-20 hidden w-1/2 opacity-75 md:grid" />
      ) : <Image
        src="/images/nebula-drift.webp"
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        sizes="(min-width: 1700px) 1360px, (min-width: 1024px) calc(100vw - 18rem), 100vw"
        className="-z-20 object-cover object-[84%_52%] sm:object-[64%_52%]"
      />}
      <div aria-hidden="true" className="dashboard-hero-scrim absolute inset-0 -z-10" />
      <div className="px-5 py-7 sm:max-w-lg sm:px-9 sm:py-9">
        {game && (
          <p className="mb-3 text-xs font-semibold tracking-[0.13em] text-primary uppercase">Dernier jeu lancé</p>
        )}
        <h2 className="break-words text-3xl leading-tight font-semibold tracking-[-0.05em] sm:text-[2.75rem]">
          {game ? game.title : "Ta bibliothèque Steam"}
        </h2>
        <p className="mt-2.5 max-w-sm text-base text-[#d2cbe3]">
          {game ? (
            <>Dernière session le <time dateTime={game.lastPlayedOn}>{formatPlayDate(game.lastPlayedOn)}</time></>
          ) : (
            "Gère ton compte Steam et la synchronisation depuis les paramètres."
          )}
        </p>
        <Link
          href={game ? "#jeux-recents" : "/settings"}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#d0c0ff]"
        >
          {game ? <History className="size-4" aria-hidden="true" /> : <Cable className="size-4" aria-hidden="true" />}
          {game ? "Voir l’activité" : "Paramètres Steam"}
        </Link>
      </div>
    </Card>
  );
}

export function Dashboard({ summary, demo = false }: { summary: LibrarySummary | null; demo?: boolean }) {
  return (
    <div className="grid gap-5 sm:gap-6">
      <PageHeading title="Tableau de bord" description="Ta bibliothèque Steam en un coup d’œil.">
        {demo && (
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/9 px-3 py-1.5 text-sm font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Données de démonstration
          </p>
        )}
      </PageHeading>

      <DashboardHero game={summary?.recentlyPlayed[0]} />

      {summary && summary.gameCount > 0 ? (
        <>
          <DashboardMetrics summary={summary} />
          <DashboardActivity summary={summary} linked={!demo} />
        </>
      ) : (
        <EmptyState
          icon={LibraryBig}
          title={summary ? "Bibliothèque vide" : "Statistiques indisponibles"}
          description={summary
            ? "Tes statistiques apparaîtront après l’import de tes jeux Steam."
            : "Connecte-toi à GameVault pour consulter tes statistiques."}
        />
      )}
    </div>
  );
}
