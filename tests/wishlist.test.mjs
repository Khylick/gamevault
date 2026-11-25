import assert from "node:assert/strict";
import { test } from "node:test";

import { findSteamStoreGame, parseSteamAppId } from "../src/features/wishlist/steam-store.ts";

const { Response } = globalThis;

test("Extrait un AppID décimal depuis une fiche Steam ou une saisie directe", () => {
  assert.equal(parseSteamAppId(" 620 "), "620");
  assert.equal(parseSteamAppId("https://store.steampowered.com/app/620/Portal_2/?l=french"), "620");
  for (const value of [
    null, "0", "4294967296", "https://store.steampowered.com.evil.test/app/620/",
    "https://user@store.steampowered.com/app/620/", "https://store.steampowered.com/bundle/620/",
  ]) {
    assert.equal(parseSteamAppId(value), null);
  }
});

test("Vérifie que le premier résultat du catalogue correspond à l’AppID demandé", async () => {
  const found = await findSteamStoreGame("620", "fixture", async (url, options) => {
    assert.equal(url.origin + url.pathname, "https://api.steampowered.com/IStoreService/GetAppList/v1/");
    assert.equal(url.searchParams.has("key"), false);
    assert.deepEqual(JSON.parse(url.searchParams.get("input_json")), { last_appid: 619, max_results: 1, include_games: true });
    assert.equal(options.headers["x-webapi-key"], "fixture");
    return Response.json({ response: { apps: [{ appid: 620, name: " Portal 2 " }] } });
  });
  assert.deepEqual(found, { status: "found", name: "Portal 2" });
  assert.deepEqual(await findSteamStoreGame("620", "fixture", async () =>
    Response.json({ response: { apps: [{ appid: 621, name: "Autre jeu" }] } })), { status: "not-found" });
  assert.deepEqual(await findSteamStoreGame("620", "fixture", async () =>
    new Response(null, { status: 429 })), { status: "unavailable" });
});
