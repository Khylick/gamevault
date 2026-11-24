import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSessionCookieOptions, getSupabaseConfig } from "./config";

export async function createSessionClient(writable = false) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: getSessionCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(updates) {
        // Le proxy actualise les cookies avant le rendu des pages.
        if (!writable) return;
        for (const { name, value, options } of updates) cookieStore.set(name, value, options);
      },
    },
  });
}
