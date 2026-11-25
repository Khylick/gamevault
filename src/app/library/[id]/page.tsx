import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveFavorite } from "@/features/library/actions";
import { getLibraryViewer, listCollections, listMemberships, readGame } from "@/features/library/data";
import { GameCover } from "@/features/library/game-cover";
import { GameCollections, ProgressForm, ReviewForm } from "@/features/library/game-forms";
import { LibraryAccess, Playtime, StatusLabel } from "@/features/library/library-ui";
import { formatLibraryDate } from "@/features/library/model";
import { MutationForm } from "@/features/library/mutation-form";

export const metadata: Metadata = { title: "Fiche de jeu" };

export default async function GamePage({ params }: PageProps<"/library/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const viewer = await getLibraryViewer();
  if (!viewer) return <LibraryAccess />;
  const game = await readGame(viewer, id.data);
  if (!game) notFound();
  const [collections, memberships] = await Promise.all([listCollections(viewer), listMemberships(viewer, id.data)]);

  return (
    <div className="grid gap-6">
      <Link href="/library" className="w-fit text-sm font-medium text-primary hover:underline">Retour à la bibliothèque</Link>
      <Card className="grid gap-5 p-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <GameCover game={game} className="aspect-[2/3] w-28 rounded-xl sm:w-full" />
        <div className="grid min-w-0 content-start gap-4">
          <PageHeading title={game.name} description={game.platform === "steam" ? "Steam" : game.platform}>
            <MutationForm action={saveFavorite}>
              <input type="hidden" name="gameId" value={game.game_id} />
              <input type="hidden" name="favorite" value={String(!game.favorite)} />
              <SubmitButton label={game.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} pendingLabel="Enregistrement…" secondary />
            </MutationForm>
          </PageHeading>
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel status={game.status} />
            {game.genres.map((genre) => <span key={genre} className="rounded-full border border-border px-2.5 py-1 text-xs">{genre}</span>)}
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div><dt className="text-sm text-muted-foreground">Temps total</dt><dd className="mt-1"><Playtime minutes={game.playtime_minutes} /></dd></div>
            <div><dt className="text-sm text-muted-foreground">Temps sur 14 jours au dernier import</dt><dd className="mt-1"><Playtime minutes={game.recent_playtime_minutes} /></dd></div>
            <div><dt className="text-sm text-muted-foreground">Dernière session</dt><dd className="mt-1">{game.last_played_at ? formatLibraryDate(game.last_played_at) : "Indisponible"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Ajout dans GameVault</dt><dd className="mt-1">{formatLibraryDate(game.created_at)}</dd></div>
          </dl>
          <p className="break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {game.description || "Description indisponible."}
          </p>
        </div>
      </Card>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <ProgressForm game={game} />
        <ReviewForm game={game} />
      </div>
      <GameCollections gameId={id.data} collections={collections} memberships={memberships} />
    </div>
  );
}
