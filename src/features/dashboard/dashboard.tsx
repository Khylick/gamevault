import { Cable, History, LibraryBig, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { GameCover } from "@/features/library/game-cover";

import { MostPlayed, RecentlyPlayed } from "./dashboard-activity";
import { DashboardMetrics } from "./dashboard-metrics";
import { defaultDashboardLayout, type DashboardLayout } from "./layout";
import { formatPlayDate, formatPlaytime, type ActivityGame, type LibrarySummary } from "./library-summary";
import type { TonightSuggestions } from "./tonight-model";
import { TonightPicks } from "./tonight-picks";

function DashboardHero({ game, showActivity, demo }: { game?: ActivityGame; showActivity: boolean; demo: boolean }) {
  const recentMinutes = game && "recentMinutes" in game ? game.recentMinutes : null;
  const activityLink = game && showActivity;
  const gameLink = game && !demo && !activityLink;
  return (
    <Card className="relative isolate flex min-h-63 items-center overflow-hidden border-primary/25 bg-hero">
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
          <p className="mb-3 text-xs font-semibold tracking-[0.13em] text-primary uppercase">
            {recentMinutes === null ? "Dernier jeu lancé" : "Activité Steam récente"}
          </p>
        )}
        <h2 className="break-words text-3xl leading-tight font-semibold tracking-[-0.05em] sm:text-[2.75rem]">
          {game ? game.title : "Ta bibliothèque Steam"}
        </h2>
        <p className="mt-2.5 max-w-sm text-base text-hero-muted">
          {recentMinutes !== null ? (
            <>{formatPlaytime(recentMinutes)} sur 14 jours au dernier import.</>
          ) : game?.lastPlayedOn ? (
            <>Dernière session le <time dateTime={game.lastPlayedOn}>{formatPlayDate(game.lastPlayedOn)}</time></>
          ) : (
            "Gère ton compte Steam et la synchronisation depuis les paramètres."
          )}
        </p>
        <Link
          href={activityLink ? "#jeux-recents" : gameLink ? "/library/" + game.id : "/settings"}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
        >
          {activityLink ? <History className="size-4" aria-hidden="true" /> : gameLink
            ? <LibraryBig className="size-4" aria-hidden="true" /> : <Cable className="size-4" aria-hidden="true" />}
          {activityLink ? "Voir l’activité" : gameLink ? "Voir la fiche du jeu" : "Paramètres Steam"}
        </Link>
      </div>
    </Card>
  );
}

export function Dashboard({ summary, layout, suggestions, demo = false }: {
  summary: LibrarySummary | null; layout?: DashboardLayout | null; suggestions?: TonightSuggestions; demo?: boolean;
}) {
  const { block_order, hidden_blocks } = layout ?? defaultDashboardLayout;
  const visible = block_order.filter((block) => !hidden_blocks.includes(block));
  const hasLibrary = Boolean(summary?.gameCount);
  const displayOrder = hasLibrary ? visible : visible.filter((block) => block === "hero");
  const recentIndex = displayOrder.indexOf("recent");
  const topIndex = displayOrder.indexOf("top");
  const paired = recentIndex >= 0 && topIndex >= 0 && Math.abs(recentIndex - topIndex) === 1;
  const recentActivity = summary?.recentActivity;
  const activity = recentActivity?.length ? recentActivity : summary?.recentlyPlayed ?? [];
  const blocks = {
    hero: <DashboardHero game={activity[0]} showActivity={recentIndex >= 0} demo={demo} />,
    metrics: summary && <DashboardMetrics summary={summary} />,
    recent: <RecentlyPlayed games={activity} recent={Boolean(recentActivity?.length)} linked={!demo} />,
    top: summary && <MostPlayed summary={summary} linked={!demo} />,
  };
  return (
    <div className="grid gap-5 sm:gap-6">
      <PageHeading title="Tableau de bord" description="Ta bibliothèque Steam en un coup d’œil.">
        {demo && (
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/9 px-3 py-1.5 text-sm font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Données de démonstration
          </p>
        )}
        {layout && (
          <Link href="/dashboard/personnaliser" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-accent">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Personnaliser
          </Link>
        )}
      </PageHeading>

      {hasLibrary && suggestions && <TonightPicks suggestions={suggestions} />}

      {displayOrder.length > 0 && (
        <div className="grid gap-x-4 gap-y-5 sm:gap-y-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {displayOrder.map((block) => (
            <div key={block} id={"dashboard-" + block} className={paired && (block === "recent" || block === "top") ? "min-w-0" : "min-w-0 md:col-span-2"}>
              {blocks[block]}
            </div>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="Les blocs personnalisables sont masqués" description="Utilise Personnaliser pour réafficher les blocs de ton choix." />
      ) : !hasLibrary && (
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
