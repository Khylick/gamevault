import { Bookmark, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { getLibraryViewer } from "@/features/library/data";
import { GameCover } from "@/features/library/game-cover";
import { LibraryAccess, PageLinks } from "@/features/library/library-ui";
import { pageSize, parseLibraryQuery } from "@/features/library/model";
import { MutationForm } from "@/features/library/mutation-form";
import { addWish, removeWish } from "@/features/wishlist/actions";

export const metadata: Metadata = { title: "Wishlist" };

type Wish = {
  game_id: string;
  name: string;
  platform: string;
  external_id: string;
  cover_url: string | null;
  owned: boolean;
};

export default async function WishlistPage({ searchParams }: PageProps<"/wishlist">) {
  const query = parseLibraryQuery({ page: (await searchParams).page });
  const heading = <PageHeading title="Wishlist" description="Retrouve les jeux Steam que tu aimerais acquérir." />;
  const viewer = await getLibraryViewer();
  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;

  const start = (query.page - 1) * pageSize;
  const { data, count, error } = await viewer.db.from("wishlist_entries")
    .select("game_id,name,platform,external_id,cover_url,owned", { count: "exact" })
    .eq("user_id", viewer.userId)
    .order("created_at", { ascending: false }).order("game_id")
    .range(start, start + pageSize - 1)
    .overrideTypes<Wish[], { merge: false }>();

  if (query.page > 1 && (error?.code === "PGRST103" || (!error && !data?.length))) redirect("/wishlist");
  if (error) throw new Error("Impossible de lire la wishlist.");

  return (
    <div className="grid gap-6">
      {heading}
      <Card className="max-w-xl p-5 sm:p-6">
        <MutationForm action={addWish} className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium">
            Lien Steam ou AppID
            <input
              name="steamApp"
              type="text"
              required
              autoComplete="off"
              maxLength={512}
              placeholder="https://store.steampowered.com/app/…"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
            />
          </label>
          <div><SubmitButton label="Ajouter à la wishlist" pendingLabel="Ajout…" /></div>
        </MutationForm>
      </Card>
      {data?.length ? (
        <>
          <ul className="grid gap-4 xl:grid-cols-2">
            {data.map((game) => (
              <li key={game.game_id}>
                <Card className="flex h-full gap-4 p-4">
                  <GameCover game={game} className="aspect-[2/3] w-18 self-start rounded-lg sm:w-22" />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-base font-semibold">{game.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <a
                        href={"https://store.steampowered.com/app/" + encodeURIComponent(game.external_id) + "/"}
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={game.name + " sur Steam (nouvel onglet)"}
                      >
                        Voir sur Steam <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                      {game.owned && (
                        <Link href={"/library/" + game.game_id} className="font-medium text-primary hover:underline">
                          Dans ta bibliothèque
                        </Link>
                      )}
                    </div>
                    <MutationForm action={removeWish} className="mt-3">
                      <input type="hidden" name="gameId" value={game.game_id} />
                      <SubmitButton label="Retirer de la wishlist" pendingLabel="Retrait…" secondary />
                    </MutationForm>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <PageLinks path="/wishlist" count={count ?? 0} query={query} page={query.page} />
        </>
      ) : (
        <EmptyState icon={Bookmark} title="Ta wishlist est vide" description="Ajoute un jeu depuis sa fiche sur Steam." />
      )}
    </div>
  );
}
