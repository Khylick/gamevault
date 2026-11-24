import { Gamepad2, Heart, LibraryBig } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatPlaytime } from "@/features/dashboard/library-summary";

import { updateMembership } from "./actions";
import { pageHref, pageSize, statusLabels, type LibraryEntry, type LibraryQuery } from "./model";
import { GameCover } from "./game-cover";
import { MutationForm } from "./mutation-form";

export function LibraryAccess() {
  return (
    <EmptyState icon={LibraryBig} title="Connecte-toi à GameVault" description="Ta bibliothèque et tes données personnelles sont liées à ton compte.">
      <Link href="/settings" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
        Ouvrir les paramètres
      </Link>
    </EmptyState>
  );
}

export function Playtime({ minutes }: { minutes: number | null }) {
  return minutes === null ? "Indisponible" : formatPlaytime(minutes);
}

export function StatusLabel({ status }: { status: LibraryEntry["status"] }) {
  return status && <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{statusLabels[status]}</span>;
}

export function StatusOptions({ unassigned = false }: { unassigned?: boolean }) {
  return (
    <>
      {unassigned && <option value="none">Sans statut</option>}
      {Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
    </>
  );
}

export function EmptyLibrary({ filtered }: { filtered: boolean }) {
  return (
    <EmptyState
      icon={Gamepad2}
      title={filtered ? "Aucun résultat" : "Bibliothèque vide"}
      description={filtered ? "Essaie d’autres filtres ou cherche un autre titre." : "Les jeux synchronisés depuis Steam apparaîtront ici."}
    >
      {!filtered && <Link href="/settings" className="font-medium text-primary hover:underline">Gérer la synchronisation Steam</Link>}
    </EmptyState>
  );
}

export function GameListing({ entries, view, collectionId }: {
  entries: LibraryEntry[];
  view: LibraryQuery["view"];
  collectionId?: string;
}) {
  if (view === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {entries.map((game) => (
          <li key={game.game_id} className="min-w-0">
            <Link href={"/library/" + game.game_id} className="block h-full rounded-xl">
              <Card className="group h-full overflow-hidden transition-colors hover:border-primary/60">
                <GameCover game={game} className="aspect-[2/3]" />
                <div className="grid gap-2 p-3 sm:p-4">
                  <h2 className="flex items-start justify-between gap-2 text-sm font-semibold sm:text-base">
                    <span className="break-words">{game.name}</span>
                    {game.favorite && <Heart className="mt-0.5 size-4 shrink-0 fill-primary text-primary" aria-label="Favori" />}
                  </h2>
                  <p className="text-xs text-muted-foreground"><Playtime minutes={game.playtime_minutes} /></p>
                  <div><StatusLabel status={game.status} /></div>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-border">
        {entries.map((game) => (
          <li key={game.game_id} className="flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4">
            <Link href={"/library/" + game.game_id} className="flex min-w-0 grow basis-42 items-center gap-3 rounded-md hover:text-primary">
              <GameCover game={game} className="aspect-[2/3] w-10 rounded-md" />
              <div className="min-w-0">
                <p className="break-words font-semibold">{game.name}</p>
                {game.genres.length > 0 && <p className="text-xs text-muted-foreground">{game.genres.join(" · ")}</p>}
              </div>
            </Link>
            {game.favorite && <Heart className="size-4 shrink-0 fill-primary text-primary" aria-label="Favori" />}
            <StatusLabel status={game.status} />
            <p className="text-sm text-muted-foreground"><Playtime minutes={game.playtime_minutes} /></p>
            {collectionId && (
              <MutationForm action={updateMembership}>
                <input type="hidden" name="gameId" value={game.game_id} />
                <input type="hidden" name="collectionId" value={collectionId} />
                <input type="hidden" name="membership" value="remove" />
                <SubmitButton label="Retirer" pendingLabel="Retrait…" secondary />
              </MutationForm>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PageLinks({ path, count, query, page }: { path: string; count: number; query: LibraryQuery; page: number }) {
  const pages = Math.ceil(count / pageSize);
  if (pages < 2) return null;
  const linkClass = "rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent";

  return (
    <nav aria-label="Pagination des jeux" className="flex flex-wrap items-center gap-3">
      {page > 1 && <Link className={linkClass} href={pageHref(path, query, page - 1)}>Précédent</Link>}
      <span className="text-sm text-muted-foreground">Page {page} sur {pages}</span>
      {page < pages && <Link className={linkClass} href={pageHref(path, query, page + 1)}>Suivant</Link>}
    </nav>
  );
}
