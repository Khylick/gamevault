import "server-only";

import { z } from "zod";

export function getAppOrigin() {
  const appUrl = z.url().safeParse(process.env.APP_URL);
  if (!appUrl.success) return null;

  const url = new URL(appUrl.data);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;

  return url.origin;
}

export function getSupabaseConfig() {
  const url = z.url({ protocol: /^https?$/ }).safeParse(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url.success && key ? { url: url.data, key } : null;
}

export function getSessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: getAppOrigin()?.startsWith("http:") !== true };
}
