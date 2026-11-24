import { ListTodo } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveStatus } from "@/features/library/actions";
import { getLibraryViewer, listLibrary } from "@/features/library/data";
import { LibraryAccess, PageLinks, StatusOptions } from "@/features/library/library-ui";
import { pageHref, parseLibraryQuery, statusLabels, type GameStatus } from "@/features/library/model";
import { MutationForm } from "@/features/library/mutation-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Backlog" };

export default async function BacklogPage({ searchParams }: PageProps<"/backlog">) {
  const parameters = parseLibraryQuery(await searchParams);
  const query = parseLibraryQuery({ page: parameters.page, status: parameters.status === "none" ? "" : parameters.status });
  const viewer = await getLibraryViewer();
  const heading = <PageHeading title="Backlog" description="Suis les jeux que tu veux commencer, reprendre ou terminer." />;

  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;

  const library = await listLibrary(viewer, query, { backlog: true });
  const filters: [GameStatus | "", string][] = [["", "Tous"], ...Object.entries(statusLabels) as [GameStatus, string][]];

  return (
    <div className="grid gap-6">
      {heading}
      <nav aria-label="Statuts du backlog" className="flex flex-wrap gap-2">
        {filters.map(([status, label]) => (
          <Link key={status} href={pageHref("/backlog", { ...query, status }, 1)}
            aria-current={query.status === status ? "page" : undefined}
            className={cn("rounded-lg border px-3 py-2 text-sm font-medium", query.status === status
              ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent")}>
            {label}
          </Link>
        ))}
      </nav>
      {library.entries.length > 0 ? (
        <>
          <Card>
            <ul className="divide-y divide-border">
              {library.entries.map((game) => (
                <li key={game.game_id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 grow basis-52">
                    <Link href={"/library/" + game.game_id} className="break-words font-semibold hover:text-primary">{game.name}</Link>
                    {game.priority && <p className="text-sm text-muted-foreground">Priorité {game.priority}/5</p>}
                    {game.goals && <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">{game.goals}</p>}
                  </div>
                  <MutationForm action={saveStatus} className="min-w-0">
                    <input type="hidden" name="gameId" value={game.game_id} />
                    <div className="flex flex-wrap items-center gap-2">
                      <select name="status" defaultValue={game.status ?? "to_start"} aria-label={"Statut de " + game.name} className="library-field w-auto">
                        <StatusOptions />
                      </select>
                      <SubmitButton label="Changer le statut" pendingLabel="Enregistrement…" secondary />
                    </div>
                  </MutationForm>
                </li>
              ))}
            </ul>
          </Card>
          <PageLinks path="/backlog" count={library.count} query={query} page={library.page} />
        </>
      ) : (
        <EmptyState icon={ListTodo} title="Aucun jeu dans ce backlog" description="Attribue un statut à un jeu depuis sa fiche pour le retrouver ici.">
          <Link href="/library" className="font-medium text-primary hover:underline">Voir ma bibliothèque</Link>
        </EmptyState>
      )}
    </div>
  );
}
