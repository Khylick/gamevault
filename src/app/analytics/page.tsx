import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { Analytics } from "@/features/analytics/analytics";
import { readAnalytics } from "@/features/analytics/data";
import { getLibraryViewer } from "@/features/library/data";
import { EmptyLibrary, LibraryAccess } from "@/features/library/library-ui";

export const metadata: Metadata = { title: "Statistiques" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const period = (await searchParams).period === "month" ? "month" : "week";
  const viewer = await getLibraryViewer();
  const heading = <PageHeading title="Statistiques" description="Explore ton temps de jeu et la progression de ton backlog." />;

  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;
  const report = await readAnalytics(viewer, period);

  return (
    <div className="grid gap-6">
      {heading}
      {report.summary.gameCount > 0 ? <Analytics report={report} period={period} /> : <EmptyLibrary filtered={false} />}
    </div>
  );
}
