import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { getLibraryViewer } from "@/features/library/data";
import { GameCover } from "@/features/library/game-cover";
import { LibraryAccess, PageLinks } from "@/features/library/library-ui";
import { pageSize, parseLibraryQuery } from "@/features/library/model";
import { parseCalendarYear } from "@/lib/year";

export const metadata: Metadata = { title: "Classements" };

type RankedGame = {
  game_id: string;
  name: string;
  platform: string;
  external_id: string;
  cover_url: string | null;
  rating: number;
  ranking_year: number | null;
  uses_release_year: boolean;
  ranking_position: number;
};

export default async function RankingsPage({ searchParams }: PageProps<"/classements">) {
  const params = await searchParams;
  const query = parseLibraryQuery({ page: params.page });
  const year = parseCalendarYear(params.year);
  const path = year === null ? "/classements" : "/classements?year=" + year;
  const viewer = await getLibraryViewer();
  const heading = (
    <PageHeading title="Classements" description={year === null ? "Tes jeux classés par année et par note." : "Tes jeux notés pour " + year + "."}>
      {year !== null && <Link href="/classements" className="text-sm font-medium text-primary hover:underline">Toutes les années</Link>}
    </PageHeading>
  );

  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;

  const start = (query.page - 1) * pageSize;
  const listing = viewer.db.from("personal_game_rankings")
    .select("game_id,name,platform,external_id,cover_url,rating,ranking_year,uses_release_year,ranking_position", { count: "exact" })
    .eq("user_id", viewer.userId);
  if (year !== null) listing.eq("ranking_year", year);
  const { data, count, error } = await listing
    .order("ranking_year", { ascending: false, nullsFirst: false })
    .order("ranking_position").order("name").order("game_id")
    .range(start, start + pageSize - 1)
    .overrideTypes<RankedGame[], { merge: false }>();

  if (query.page > 1 && (error?.code === "PGRST103" || (!error && !data?.length))) redirect(path);
  if (error) throw new Error("Impossible de lire tes classements.");

  const years = new Map<number | null, RankedGame[]>();
  for (const game of data ?? []) {
    const group = years.get(game.ranking_year);
    if (group) group.push(game);
    else years.set(game.ranking_year, [game]);
  }

  return (
    <div className="grid gap-6">
      {heading}
      {years.size ? (
        <>
          {[...years].map(([year, games]) => (
            <section key={year ?? "unknown"} aria-labelledby={"classement-" + (year ?? "sans-annee")} className="grid gap-3">
              <h2 id={"classement-" + (year ?? "sans-annee")} className="text-xl font-semibold">{year ?? "Sans année"}</h2>
              <Card className="p-4 sm:p-5">
                <ol className="divide-y divide-border">
                  {games.map((game) => (
                    <li key={game.game_id} value={game.ranking_position} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
                      <span className="w-9 shrink-0 text-center text-lg font-semibold text-primary tabular-nums">
                        <span className="sr-only">Rang </span>{game.ranking_position}
                      </span>
                      <GameCover game={game} className="aspect-[2/3] w-10 rounded-md sm:w-12" />
                      <div className="min-w-0 flex-1">
                        <Link href={"/library/" + game.game_id} className="break-words text-sm font-semibold hover:text-primary sm:text-base">
                          {game.name}
                        </Link>
                        {game.uses_release_year && <p className="mt-0.5 text-xs text-muted-foreground">Année de sortie Steam</p>}
                      </div>
                      <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-semibold text-primary tabular-nums">
                        {game.rating} / 10
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          ))}
          <PageLinks path={path} count={count ?? 0} query={query} page={query.page} />
        </>
      ) : (
        <EmptyState icon={Trophy} title={year === null ? "Aucun jeu noté" : "Aucune note pour " + year}
          description="Ajoute une note dans une fiche pour retrouver le jeu dans ton classement.">
          <Link href="/library" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Ouvrir la bibliothèque
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
