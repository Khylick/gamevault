import { z } from "zod";

const steamEndpoint = "https://steamcommunity.com/openid/login";
const namespace = "http://specs.openid.net/auth/2.0";
const selectIdentity = namespace + "/identifier_select";
const callbackPath = "/auth/steam/callback";
const signedFields = ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"];

export const stateSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const steamStateCookie = "gamevault_steam_state";
export const steamStateMaxAge = 600;

function buildReturnTo(origin: string, state: string) {
  const url = new URL(callbackPath, origin);
  url.searchParams.set("state", state);
  return url.href;
}

export function getSteamStateCookieOptions(origin: string) {
  return { path: callbackPath, httpOnly: true, sameSite: "lax" as const, secure: origin.startsWith("https:") };
}

export function buildSteamSignInUrl(origin: string, state: string) {
  const target = new URL(steamEndpoint);
  target.search = new URLSearchParams({
    "openid.ns": namespace,
    "openid.mode": "checkid_setup",
    "openid.claimed_id": selectIdentity,
    "openid.identity": selectIdentity,
    "openid.return_to": buildReturnTo(origin, state),
    "openid.realm": origin + "/",
  }).toString();
  return target.href;
}

const assertionSchema = z.object({
  "openid.ns": z.literal(namespace),
  "openid.mode": z.literal("id_res"),
  "openid.op_endpoint": z.literal(steamEndpoint),
  "openid.claimed_id": z.string().regex(/^https?:\/\/steamcommunity\.com\/openid\/id\/[1-9][0-9]{16}$/),
  "openid.identity": z.string(),
  "openid.return_to": z.string(),
  "openid.response_nonce": z.string().min(20).max(255),
  "openid.assoc_handle": z.string().min(1).max(255),
  "openid.signed": z.string().min(1).max(1024),
  "openid.sig": z.string().min(1).max(1024),
});

function isCurrentNonce(nonce: string, now: number) {
  const timestamp = nonce.slice(0, 20);
  if (!z.iso.datetime({ precision: 0 }).safeParse(timestamp).success) return false;
  const age = now - Date.parse(timestamp);
  return age >= -60_000 && age <= 5 * 60_000;
}

export type SteamAssertionResult =
  | { status: "verified"; steamId: string }
  | { status: "steam-cancelled" | "steam-invalid" | "steam-unavailable" };

export async function verifySteamAssertion(
  params: URLSearchParams, origin: string, state: string, fetcher = fetch, now = Date.now(),
): Promise<SteamAssertionResult> {
  const invalid = { status: "steam-invalid" } as const;
  if (Array.from(params.keys()).some((key) => params.getAll(key).length !== 1)) return invalid;
  if (params.get("state") !== state) return invalid;
  if (params.get("openid.mode") === "cancel") return { status: "steam-cancelled" };

  const parsed = assertionSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return invalid;

  const assertion = parsed.data;
  const signed = new Set(assertion["openid.signed"].split(","));
  if (
    assertion["openid.return_to"] !== buildReturnTo(origin, state) ||
    assertion["openid.identity"] !== assertion["openid.claimed_id"] ||
    !signedFields.every((field) => signed.has(field)) ||
    !isCurrentNonce(assertion["openid.response_nonce"], now)
  ) return invalid;

  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

  try {
    const response = await fetcher(steamEndpoint, {
      method: "POST",
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 400) return invalid;
    if (!response.ok) return { status: "steam-unavailable" };
    const lines = (await response.text()).split(/\r?\n/);
    const valid = lines.filter((line) => line.startsWith("is_valid:"));
    const responseNamespace = lines.filter((line) => line.startsWith("ns:"));
    if (valid.length !== 1 || valid[0] !== "is_valid:true") return invalid;
    if (responseNamespace.length !== 1 || responseNamespace[0] !== "ns:" + namespace) return invalid;

    return { status: "verified", steamId: assertion["openid.claimed_id"].slice(-17) };
  } catch {
    return { status: "steam-unavailable" };
  }
}
