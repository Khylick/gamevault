import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

export function hasSupabaseServerKey() {
  return Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
}

export function createAdminClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !key) return null;

  return createClient(config.url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
