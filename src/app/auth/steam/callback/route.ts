import { cookies } from "next/headers";

import {
  getSteamStateCookieOptions, stateSchema, steamStateCookie, verifySteamAssertion,
} from "@/features/steam/openid";
import { returnToSettings } from "@/features/steam/settings-notice";
import { completeSteamLink, synchronizeSteamLibrary } from "@/features/steam/steam-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/session";

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const admin = createAdminClient();
  const supabase = await createSessionClient(true);
  if (!origin || !admin || !supabase) return returnToSettings("configuration");

  const searchParams = new URL(request.url).searchParams;
  const states = searchParams.getAll("state");
  const state = stateSchema.safeParse(states.length === 1 ? states[0] : undefined);
  const cookieStore = await cookies();
  if (!state.success || cookieStore.get(steamStateCookie)?.value !== state.data) {
    return returnToSettings("steam-expired");
  }
  cookieStore.set(steamStateCookie, "", { ...getSteamStateCookieOptions(origin), maxAge: 0 });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return returnToSettings("session-required");

  const assertion = await verifySteamAssertion(searchParams, origin, state.data);
  if (assertion.status !== "verified") return returnToSettings(assertion.status);

  const outcome = await completeSteamLink(admin, data.user.id, state.data, assertion.steamId);
  if (outcome !== "linked") return returnToSettings(outcome);

  return returnToSettings(await synchronizeSteamLibrary(admin, data.user.id, assertion.steamId));
}
