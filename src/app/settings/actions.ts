"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buildSteamSignInUrl, getSteamStateCookieOptions, steamStateCookie, steamStateMaxAge } from "@/features/steam/openid";
import { settingsLocation } from "@/features/steam/settings-notice";
import { getSteamAccount, hasSteamApiKey, issueSteamChallenge, synchronizeSteamLibrary } from "@/features/steam/steam-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/session";

const emailSchema = z.string().trim().max(254).pipe(z.email());
const loginPasswordSchema = z.string().min(1).max(1024);
const newPasswordSchema = z.string().min(8).max(72)
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72);

function readNewPassword(formData: FormData) {
  const password = newPasswordSchema.safeParse(formData.get("password"));
  return password.success && password.data === formData.get("passwordConfirmation") ? password.data : null;
}

export async function signInWithPassword(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect(settingsLocation("auth-invalid-email"));
  const password = loginPasswordSchema.safeParse(formData.get("password"));
  if (!password.success) redirect(settingsLocation("auth-password-required"));

  const supabase = await createSessionClient(true);
  if (!supabase || !getAppOrigin()) redirect(settingsLocation("configuration"));

  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error?.status === 429) redirect(settingsLocation("auth-rate-limit"));
  if (error?.code === "invalid_credentials") redirect(settingsLocation("auth-invalid-credentials"));
  if (error?.code === "email_not_confirmed") redirect(settingsLocation("auth-email-unconfirmed"));
  if (error) redirect(settingsLocation("auth-error"));
  redirect("/settings");
}

export async function signUp(formData: FormData) {
  const mode = "signup";
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect(settingsLocation("auth-invalid-email", mode));
  const password = readNewPassword(formData);
  if (!password) redirect(settingsLocation("auth-invalid-password", mode));

  const origin = getAppOrigin();
  const supabase = await createSessionClient(true);
  if (!origin || !supabase) redirect(settingsLocation("configuration", mode));

  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password,
    options: { emailRedirectTo: new URL("/auth/callback", origin).href },
  });
  if (error?.status === 429) redirect(settingsLocation("auth-rate-limit", mode));
  if (error?.code === "weak_password") redirect(settingsLocation("auth-weak-password", mode));
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") {
    redirect(settingsLocation("auth-error", mode));
  }
  if (data.session) redirect("/settings");
  redirect(settingsLocation("auth-signup-sent"));
}

export async function requestPasswordReset(formData: FormData) {
  const mode = "forgot-password";
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect(settingsLocation("auth-invalid-email", mode));

  const origin = getAppOrigin();
  const supabase = await createSessionClient(true);
  if (!origin || !supabase) redirect(settingsLocation("configuration", mode));

  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: new URL("/auth/callback", origin).href,
  });
  if (error?.status === 429) redirect(settingsLocation("auth-rate-limit", mode));
  if (error && error.code !== "user_not_found") redirect(settingsLocation("auth-error", mode));
  redirect(settingsLocation("auth-recovery-sent", mode));
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

export async function updatePassword(formData: FormData) {
  const { supabase } = await requireUser();
  const mode = "password";
  const password = readNewPassword(formData);
  if (!password) redirect(settingsLocation("auth-invalid-password", mode));

  const { error } = await supabase.auth.updateUser({ password });
  if (error?.status === 429) redirect(settingsLocation("auth-rate-limit", mode));
  if (error?.code === "same_password") redirect(settingsLocation("auth-same-password", mode));
  if (error?.code === "weak_password") redirect(settingsLocation("auth-weak-password", mode));
  if (error?.code === "reauthentication_needed") redirect(settingsLocation("auth-password-reauth"));
  if (error) redirect(settingsLocation("auth-error", mode));
  redirect(settingsLocation("auth-password-updated"));
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

export async function setSteamAutoSync(formData: FormData) {
  const { supabase } = await requireUser();
  const enabled = z.enum(["true", "false"]).safeParse(formData.get("enabled"));
  if (!enabled.success) redirect(settingsLocation("service-error"));
  const active = enabled.data === "true";
  if (active && (!hasSteamApiKey() || !process.env.CRON_SECRET?.trim() || !createAdminClient())) {
    redirect(settingsLocation("configuration"));
  }

  const { data, error } = await supabase.rpc("set_steam_auto_sync", { p_enabled: active });
  if (error) redirect(settingsLocation("service-error"));
  if (data !== true) redirect(settingsLocation("steam-not-linked"));
  redirect(settingsLocation(active ? "auto-sync-enabled" : "auto-sync-disabled"));
}
