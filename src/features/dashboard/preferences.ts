import "server-only";

import type { LibraryViewer } from "@/features/library/data";

import { dashboardLayoutSchema, defaultDashboardLayout } from "./layout";

export async function readDashboardLayout({ db, userId }: LibraryViewer) {
  const { data, error } = await db.from("dashboard_preferences").select("block_order,hidden_blocks")
    .eq("user_id", userId).maybeSingle();
  if (error) return null;

  const layout = dashboardLayoutSchema.safeParse(data);
  return layout.success ? layout.data : defaultDashboardLayout;
}
