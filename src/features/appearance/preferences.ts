import "server-only";

import { cache } from "react";

import { getLibraryViewer } from "@/features/library/data";

import { defaultTheme, themeSchema } from "./themes";

export const readTheme = cache(async () => {
  const viewer = await getLibraryViewer();
  if (!viewer) return defaultTheme;

  const { db, userId } = viewer;
  const { data } = await db.from("appearance_preferences").select("theme")
    .eq("user_id", userId).maybeSingle();
  return themeSchema.safeParse(data?.theme).data ?? defaultTheme;
});
