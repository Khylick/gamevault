import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { LayoutEditor } from "@/features/dashboard/layout-editor";
import { readDashboardLayout } from "@/features/dashboard/preferences";
import { getLibraryViewer } from "@/features/library/data";
import { LibraryAccess } from "@/features/library/library-ui";

export const metadata: Metadata = { title: "Personnaliser le tableau de bord" };

export default async function CustomizeDashboardPage() {
  const viewer = await getLibraryViewer();
  const layout = viewer && await readDashboardLayout(viewer);

  return (
    <div className="grid gap-6">
      <PageHeading title="Personnaliser le tableau de bord" description="Choisis les blocs à afficher et leur ordre." />
      {layout ? <LayoutEditor initial={layout} /> : viewer ? (
        <div className="grid gap-3">
          <p className="text-muted-foreground">La personnalisation du tableau de bord est indisponible.</p>
          <Link href="/" className="w-fit text-sm font-medium text-primary hover:underline">Retour au tableau de bord</Link>
        </div>
      ) : <LibraryAccess />}
    </div>
  );
}
