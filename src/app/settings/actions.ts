"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buildSteamSignInUrl, getSteamStateCookieOptions, steamStateCookie, steamStateMaxAge } from "@/features/steam/openid";
import { settingsLocation } from "@/features/steam/settings-notice";
import { getSteamAccount, issueSteamChallenge, synchronizeSteamLibrary } from "@/features/steam/steam-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/session";

const emailSchema = z.string().trim().max(254).pipe(z.email());

export async function sendSignInLink(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect(settingsLocation("auth-invalid-email"));

  const origin = getAppOrigin();
  const supabase = await createSessionClient(true);
  if (!origin || !supabase) redirect(settingsLocation("configuration"));

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: new URL("/auth/callback", origin).href },
  });

  if (error) redirect(settingsLocation(error.status === 429 ? "auth-rate-limit" : "auth-error"));
  redirect(settingsLocation("auth-sent"));
}

export async function signOut() {
  const supabase = await createSessionClient(true);
  if (!supabase) redirect(settingsLocation("configuration"));

  const { error } = await supabase.auth.signOut({ scope: "local" });
  redirect(settingsLocation(error ? "auth-error" : "signed-out"));
}

async function requireUser() {
  const supabase = await createSessionClient(true);
  if (!supabase) redirect(settingsLocation("configuration"));

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(settingsLocation("session-required"));

  return { supabase, userId: data.user.id };
}

export async function startSteamLink() {
  const { supabase, userId } = await requireUser();
  const admin = createAdminClient();
  const origin = getAppOrigin();
  if (!admin || !origin) redirect(settingsLocation("configuration"));

  const account = await getSteamAccount(supabase, userId);
  if (account.error) redirect(settingsLocation("service-error"));
  if (account.data) redirect(settingsLocation("steam-already-linked"));

  const state = await issueSteamChallenge(admin, userId);
  if (!state) redirect(settingsLocation("service-error"));

  (await cookies()).set(steamStateCookie, state, { ...getSteamStateCookieOptions(origin), maxAge: steamStateMaxAge });
  redirect(buildSteamSignInUrl(origin, state));
}

export async function syncSteamLibrary() {
  const { supabase, userId } = await requireUser();
  const admin = createAdminClient();
  if (!admin) redirect(settingsLocation("configuration"));

  const account = await getSteamAccount(supabase, userId);
  if (account.error) redirect(settingsLocation("service-error"));
  if (!account.data) redirect(settingsLocation("steam-not-linked"));

  const result = await synchronizeSteamLibrary(admin, userId, account.data.steam_id);
  redirect(settingsLocation(result));
}
