import "server-only";

import type { createAdminClient } from "./admin";

export async function claimExternalRequest(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  operation: "advisor" | "steam_sync" | "steam_wishlist" | "steam_achievements",
) {
  const { data, error } = await admin.rpc("claim_external_request", { p_user_id: userId, p_operation: operation });
  if (error || typeof data !== "boolean") return "error";
  return data ? "allowed" : "limited";
}
