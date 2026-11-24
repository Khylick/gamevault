import { createSessionClient } from "@/lib/supabase/session";
import { returnToSettings } from "@/features/steam/settings-notice";

export async function GET(request: Request) {
  const codes = new URL(request.url).searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 512) return returnToSettings("auth-invalid-link");

  const supabase = await createSessionClient(true);
  if (!supabase) return returnToSettings("configuration");

  const { data, error } = await supabase.auth.exchangeCodeForSession(codes[0]);
  if (error) return returnToSettings("auth-invalid-link");
  // Le client PKCE renvoie redirectType, absent du type public AuthTokenResponse.
  const recovery = "redirectType" in data && data.redirectType === "recovery";

  return new Response(null, {
    status: 303,
    headers: {
      Location: recovery ? "/settings?mode=password" : "/settings",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
