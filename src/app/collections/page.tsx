import { FolderClosed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCollection } from "@/features/library/actions";
import { CollectionFields } from "@/features/library/collection-fields";
import { getLibraryViewer, listCollections } from "@/features/library/data";
import { LibraryAccess } from "@/features/library/library-ui";
import { MutationForm } from "@/features/library/mutation-form";

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const heading = <PageHeading title="Collections" description="Regroupe tes jeux comme tu le souhaites." />;
  const viewer = await getLibraryViewer();
  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;
  const collections = await listCollections(viewer);

  return (
    <div className="grid gap-6">
      {heading}
      <Card className="max-w-xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Nouvelle collection</h2>
        <MutationForm action={createCollection} className="mt-4 grid gap-4">
          <CollectionFields />
          <div><SubmitButton label="Créer la collection" pendingLabel="Création…" /></div>
        </MutationForm>
      </Card>
      {collections.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map(({ id, name, description }) => (
            <li key={id}>
              <Link href={"/collections/" + id} className="block h-full rounded-xl">
                <Card className="h-full p-5 transition-colors hover:border-primary/60">
                  <FolderClosed className="mb-3 size-5 text-primary" aria-hidden="true" />
                  <h2 className="break-words font-semibold">{name}</h2>
                  {description && <p className="mt-2 line-clamp-3 break-words text-sm text-muted-foreground">{description}</p>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FolderClosed} title="Aucune collection" description="Crée ta première collection, puis ajoute des jeux depuis leur fiche." />
      )}
    </div>
  );
}
