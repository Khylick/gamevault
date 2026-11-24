import assert from "node:assert/strict";
import { test } from "node:test";
import { URL, URLSearchParams } from "node:url";

import { buildSteamSignInUrl, verifySteamAssertion } from "../src/features/steam/openid.ts";
import { fetchOwnedGames } from "../src/features/steam/steam-api.ts";

const origin = "https://vault.example.test";
const state = "a".repeat(64);
const steamId = "76561197960265729";
const now = Date.parse("2026-11-24T10:30:00Z");
const { Response, fetch } = globalThis;

function assertion() {
  const request = new URL(buildSteamSignInUrl(origin, state));
  return new URLSearchParams({
    state,
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": request.origin + request.pathname,
    "openid.claimed_id": "http://steamcommunity.com/openid/id/" + steamId,
    "openid.identity": "http://steamcommunity.com/openid/id/" + steamId,
    "openid.return_to": request.searchParams.get("openid.return_to"),
    "openid.response_nonce": "2026-11-24T10:29:59Zsteam",
    "openid.assoc_handle": "test",
    "openid.signed": "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "test",
  });
}

test("Construit une demande OpenID pour le fournisseur officiel et un retour lié à l’état", () => {
  const request = new URL(buildSteamSignInUrl(origin, state));
  assert.equal(request.origin + request.pathname, "https://steamcommunity.com/openid/login");
  assert.equal(request.searchParams.get("openid.mode"), "checkid_setup");
  assert.equal(request.searchParams.get("openid.realm"), origin + "/");
  assert.equal(request.searchParams.get("openid.return_to"), origin + "/auth/steam/callback?state=" + state);
});

test("Soumet l’assertion à Steam avant de récupérer son identifiant texte", async () => {
  const result = await verifySteamAssertion(assertion(), origin, state, async (url, init) => {
    assert.equal(url, "https://steamcommunity.com/openid/login");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(init.body.get("openid.mode"), "check_authentication");
    assert.equal(init.body.has("state"), false);
    assert.equal(init.body.get("openid.claimed_id"), "http://steamcommunity.com/openid/id/" + steamId);
    return new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n");
  }, now);
  assert.deepEqual(result, { status: "verified", steamId });
});

test("Refuse les assertions incohérentes avant tout appel au fournisseur", async () => {
  const cases = [
    (parameters) => parameters.append("openid.identity", parameters.get("openid.identity")),
    (parameters) => parameters.set("openid.identity", "http://steamcommunity.com/openid/id/76561197960265730"),
    (parameters) => parameters.set("openid.return_to", origin + "/other"),
    (parameters) => parameters.set("openid.op_endpoint", "https://provider.example.test/"),
    (parameters) => parameters.set("openid.signed", "claimed_id,identity,return_to,response_nonce,assoc_handle"),
    (parameters) => parameters.set("openid.response_nonce", "2026-11-24T10:00:00Zold"),
    (parameters) => parameters.set("openid.response_nonce", "2026-11-24T11:00:00Zfuture"),
    (parameters) => parameters.set("state", "b".repeat(64)),
  ];
  let calls = 0;
  for (const change of cases) {
    const parameters = assertion();
    change(parameters);
    const result = await verifySteamAssertion(parameters, origin, state, async () => {
      calls += 1;
      return new Response("is_valid:true\n");
    }, now);
    assert.deepEqual(result, { status: "steam-invalid" });
  }
  assert.equal(calls, 0);
});

test("Distingue une annulation, un refus d’assertion et une indisponibilité Steam", async () => {
  assert.deepEqual(await verifySteamAssertion(
    new URLSearchParams({ state, "openid.mode": "cancel" }), origin, state, fetch, now,
  ), { status: "steam-cancelled" });
  assert.deepEqual(await verifySteamAssertion(
    assertion(), origin, state, async () => new Response("is_valid:false\n"), now,
  ), { status: "steam-invalid" });
  assert.deepEqual(await verifySteamAssertion(
    assertion(), origin, state, async () => new Response(null, { status: 503 }), now,
  ), { status: "steam-unavailable" });
});

test("Normalise les jeux Steam, garde le zéro et les mesures indisponibles distincts", async () => {
  const result = await fetchOwnedGames(steamId, "test-key", async (url, init) => {
    assert.equal(url.hostname, "api.steampowered.com");
    assert.equal(url.pathname, "/IPlayerService/GetOwnedGames/v1/");
    assert.equal(url.searchParams.get("steamid"), steamId);
    assert.equal(url.searchParams.get("include_played_free_games"), "1");
    assert.equal(url.searchParams.has("key"), false);
    assert.equal(init.headers["x-webapi-key"], "test-key");
    return Response.json({
      response: { game_count: 2, games: [
        { appid: 123, name: " Orbite ", playtime_forever: 0, rtime_last_played: 0 },
        { appid: 456, playtime_forever: 90, playtime_2weeks: 30, rtime_last_played: 1_795_523_400 },
      ] },
    });
  });
  assert.deepEqual(result, { status: "available", games: [
    { external_id: "123", name: "Orbite", playtime_minutes: 0, recent_playtime_minutes: null, last_played_at: null },
    { external_id: "456", name: null, playtime_minutes: 90, recent_playtime_minutes: 30, last_played_at: new Date(1_795_523_400_000).toISOString() },
  ] });
});

test("Distingue une bibliothèque inaccessible d’une liste vide confirmée", async () => {
  const inaccessible = await fetchOwnedGames(steamId, "test-key", async () => Response.json({ response: {} }));
  assert.deepEqual(inaccessible, { status: "library-inaccessible" });
  const empty = await fetchOwnedGames(steamId, "test-key", async () => Response.json({ response: { game_count: 0 } }));
  assert.deepEqual(empty, { status: "available", games: [] });
});

test("Refuse les listes partielles, les doublons et les mesures incohérentes", async () => {
  for (const response of [
    { game_count: 2, games: [{ appid: 1 }] },
    { game_count: 2, games: [{ appid: 1 }, { appid: 1 }] },
    { game_count: 1, games: [{ appid: 1, playtime_forever: 5, playtime_2weeks: 10 }] },
  ]) {
    const result = await fetchOwnedGames(steamId, "test-key", async () => Response.json({ response }));
    assert.deepEqual(result, { status: "steam-invalid-library" });
  }
});

test("Convertit les erreurs HTTP de l’API en états d’interface", async () => {
  for (const [http, status] of [[403, "steam-api-key"], [429, "steam-rate-limit"], [503, "steam-unavailable"]]) {
    const result = await fetchOwnedGames(steamId, "test-key", async () => new Response(null, { status: http }));
    assert.deepEqual(result, { status });
  }
});
