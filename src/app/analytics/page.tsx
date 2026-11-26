import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { Analytics } from "@/features/analytics/analytics";
import { AnnualReport } from "@/features/analytics/annual-report";
import { readAnalytics, readAnnualLibraryReport } from "@/features/analytics/data";
import { getLibraryViewer } from "@/features/library/data";
import { EmptyLibrary, LibraryAccess } from "@/features/library/library-ui";
import { cn } from "@/lib/utils";
import { parseCalendarYear } from "@/lib/year";

export const metadata: Metadata = { title: "Statistiques" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const params = await searchParams;
  const period = params.period === "month" ? "month" : "week";
  const annual = params.view === "annual";
  const viewer = await getLibraryViewer();
  const heading = <PageHeading title="Statistiques" description="Explore ton temps de jeu et la progression de ton backlog." />;

  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;
  const report = annual ? null : await readAnalytics(viewer, period);
  const annualReport = annual ? await readAnnualLibraryReport(viewer, parseCalendarYear(params.year)) : null;

  return (
    <div className="grid gap-6">
      {heading}
      <nav aria-label="Vues des statistiques" className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
        {[
          { label: "Vue d’ensemble", href: "/analytics", current: !annual },
          { label: "Bilan annuel", href: "/analytics?view=annual", current: annual },
        ].map(({ label, href, current }) => (
          <Link key={href} href={href} aria-current={current ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-sm", current ? "bg-accent font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        ))}
      </nav>
      {annualReport ? <AnnualReport report={annualReport} />
        : report && report.summary.gameCount > 0 ? <Analytics report={report} period={period} />
        : <EmptyLibrary filtered={false} />}
    </div>
  );
}
