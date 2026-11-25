import "server-only";

import { z } from "zod";

import type { createSessionClient } from "@/lib/supabase/session";

const progressSchema = z.object({
  complete: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  deferred: z.number().int().nonnegative(),
});

export async function readSteamMetadataProgress(db: NonNullable<Awaited<ReturnType<typeof createSessionClient>>>) {
  const { data, error } = await db.rpc("steam_metadata_progress").maybeSingle();
  if (error) return null;
  const progress = progressSchema.safeParse(data);
  return progress.success ? progress.data : null;
}
