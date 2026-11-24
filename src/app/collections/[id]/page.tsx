import { FolderClosed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteCollection, updateCollection } from "@/features/library/actions";
import { CollectionFields } from "@/features/library/collection-fields";
import { getLibraryViewer, listLibrary, readCollection } from "@/features/library/data";
import { GameListing, LibraryAccess, PageLinks } from "@/features/library/library-ui";
import { parseLibraryQuery } from "@/features/library/model";
import { MutationForm } from "@/features/library/mutation-form";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const viewer = await getLibraryViewer();
  if (!viewer) return <LibraryAccess />;
  const collection = await readCollection(viewer, id.data);
  if (!collection) notFound();

  const query = parseLibraryQuery({ page: (await searchParams).page });
  const library = await listLibrary(viewer, query, { collectionId: id.data });

  return (
    <div className="grid gap-6">
      <Link href="/collections" className="w-fit text-sm font-medium text-primary hover:underline">Retour aux collections</Link>
      <PageHeading title={collection.name} description={collection.description ?? undefined} />
      {library.entries.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground" role="status">{library.count} {library.count === 1 ? "jeu" : "jeux"}</p>
          <GameListing entries={library.entries} view="list" collectionId={id.data} />
          <PageLinks path={"/collections/" + id.data} count={library.count} query={query} page={library.page} />
        </>
      ) : (
        <EmptyState icon={FolderClosed} title="Cette collection est vide" description="Ouvre la fiche d’un jeu pour l’ajouter à cette collection.">
          <Link href="/library" className="font-medium text-primary hover:underline">Voir ma bibliothèque</Link>
        </EmptyState>
      )}
      <Card className="max-w-xl p-5 sm:p-6">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Modifier la collection</summary>
          <MutationForm action={updateCollection} className="mt-4 grid gap-4">
            <input type="hidden" name="collectionId" value={id.data} />
            <CollectionFields collection={collection} />
            <div><SubmitButton label="Enregistrer la collection" pendingLabel="Enregistrement…" /></div>
          </MutationForm>
          <MutationForm action={deleteCollection} className="mt-5 border-t border-border pt-4">
            <input type="hidden" name="collectionId" value={id.data} />
            <SubmitButton label="Supprimer la collection" pendingLabel="Suppression…" secondary />
          </MutationForm>
        </details>
      </Card>
    </div>
  );
}
