"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLibraryViewer } from "@/features/library/data";

import { dashboardLayoutSchema, isDefaultDashboardLayout } from "./layout";

export async function saveDashboardLayout(_previous: string | null, form: FormData): Promise<string | null> {
  const encoded = form.get("layout");
  if (typeof encoded !== "string" || encoded.length > 512) return "Disposition invalide.";
  let payload: unknown;
  try {
    payload = JSON.parse(encoded);
  } catch {
    return "Disposition invalide.";
  }
  const layout = dashboardLayoutSchema.safeParse(payload);
  if (!layout.success) return "Disposition invalide.";

  const viewer = await getLibraryViewer(true);
  if (!viewer) return "Reconnecte-toi à GameVault pour enregistrer ta disposition.";

  const { db, userId } = viewer;
  const { error } = isDefaultDashboardLayout(layout.data)
    ? await db.from("dashboard_preferences").delete().eq("user_id", userId)
    : await db.from("dashboard_preferences").upsert({ user_id: userId, ...layout.data });
  if (error) return "La disposition n’a pas pu être enregistrée. Réessaie dans quelques instants.";

  revalidatePath("/");
  revalidatePath("/dashboard/personnaliser");
  redirect("/");
}
