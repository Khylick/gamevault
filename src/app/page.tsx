import { Dashboard } from "@/features/dashboard/dashboard";
import { summarizeLibrary } from "@/features/dashboard/library-summary";

export default async function HomePage() {
  const summary = process.env.NODE_ENV === "development"
    ? summarizeLibrary((await import("@/features/dashboard/demo-library")).demoLibrary)
    : null;

  return <Dashboard summary={summary} />;
}
