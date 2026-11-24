import { readDashboard } from "@/features/analytics/data";
import { Dashboard } from "@/features/dashboard/dashboard";
import { summarizeLibrary } from "@/features/dashboard/library-summary";
import { getLibraryViewer } from "@/features/library/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getLibraryViewer();
  if (viewer) return <Dashboard summary={await readDashboard(viewer)} />;

  if (process.env.NODE_ENV === "development") {
    const { demoLibrary } = await import("@/features/dashboard/demo-library");
    return <Dashboard summary={summarizeLibrary(demoLibrary)} demo />;
  }

  return <Dashboard summary={null} />;
}
