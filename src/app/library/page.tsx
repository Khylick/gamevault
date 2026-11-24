import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { getLibraryViewer, listGenres, listLibrary } from "@/features/library/data";
import { LibraryFilters } from "@/features/library/library-filters";
import { EmptyLibrary, GameListing, LibraryAccess, PageLinks } from "@/features/library/library-ui";
import { parseLibraryQuery } from "@/features/library/model";

export const metadata: Metadata = { title: "Ma bibliothèque" };

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const query = parseLibraryQuery(await searchParams);
  const viewer = await getLibraryViewer();
  const heading = <PageHeading title="Ma bibliothèque" description="Retrouve tes jeux et organise ta progression." />;

  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;

  const [library, genres] = await Promise.all([listLibrary(viewer, query), listGenres(viewer)]);
  const filtered = Boolean(query.q || query.genre || query.status || query.time || query.favorite);

  return (
    <div className="grid gap-6">
      {heading}
      <LibraryFilters query={query} genres={genres} />
      {library.count > 0 ? (
        <>
          <p className="text-sm text-muted-foreground" role="status">{library.count} {library.count === 1 ? "jeu" : "jeux"}</p>
          <GameListing entries={library.entries} view={query.view} />
          <PageLinks path="/library" count={library.count} query={query} page={library.page} />
        </>
      ) : <EmptyLibrary filtered={filtered} />}
    </div>
  );
}
