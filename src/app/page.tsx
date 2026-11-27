import { readDashboard } from "@/features/analytics/data";
import { Dashboard } from "@/features/dashboard/dashboard";
import { summarizeLibrary } from "@/features/dashboard/library-summary";
import { readDashboardLayout } from "@/features/dashboard/preferences";
import { readTonightSuggestions } from "@/features/dashboard/tonight-data";
import { getLibraryViewer } from "@/features/library/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getLibraryViewer();
  if (viewer) {
    const [summary, layout, suggestions] = await Promise.all([
      readDashboard(viewer), readDashboardLayout(viewer), readTonightSuggestions(viewer),
    ]);
    return <Dashboard summary={summary} layout={layout} suggestions={suggestions} />;
  }

  if (process.env.NODE_ENV === "development") {
    const { demoLibrary } = await import("@/features/dashboard/demo-library");
    return <Dashboard summary={summarizeLibrary(demoLibrary)} demo />;
  }

  return <Dashboard summary={null} />;
}
