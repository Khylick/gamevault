import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchSteamAchievements } from "../src/features/achievements/steam-api.ts";

const { Response } = globalThis;
const steamId = "76561197960265729";

test("Lit les succès Steam dans la langue demandée et conserve les dates inconnues", async () => {
  const result = await fetchSteamAchievements(steamId, "620", "test-key", async (url, init) => {
    assert.equal(url.origin + url.pathname, "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/");
    assert.equal(url.searchParams.get("steamid"), steamId);
    assert.equal(url.searchParams.get("appid"), "620");
    assert.equal(url.searchParams.get("l"), "french");
    assert.equal(url.searchParams.has("key"), false);
    assert.equal(init.headers["x-webapi-key"], "test-key");
    return Response.json({ playerstats: { success: true, steamID: steamId, achievements: [
      { apiname: "FIRST", achieved: 1, name: " Premier pas ", description: "Terminer le tutoriel", unlocktime: 1_795_523_400 },
      { apiname: "NEXT", achieved: 0, unlocktime: 1 },
      { apiname: "LEGACY", achieved: 1, unlocktime: 0 },
    ] } });
  });
  assert.deepEqual(result, {
    status: "available",
    achievements: [
      { id: "FIRST", title: "Premier pas", description: "Terminer le tutoriel", unlocked: true, unlockedAt: new Date(1_795_523_400_000).toISOString() },
      { id: "NEXT", title: "NEXT", description: null, unlocked: false, unlockedAt: null },
      { id: "LEGACY", title: "LEGACY", description: null, unlocked: true, unlockedAt: null },
    ],
  });
});

test("Distingue une liste vide d’une réponse inaccessible, limitée ou incomplète", async () => {
  const cases = [
    [Response.json({ playerstats: { success: true, achievements: [] } }), { status: "available", achievements: [] }],
    [Response.json({ playerstats: { success: false, error: "Profile is not public" } }, { status: 400 }), { status: "inaccessible" }],
    [new Response(null, { status: 429 }), { status: "rate-limited" }],
    [Response.json({ playerstats: { success: true } }), { status: "unavailable" }],
    [Response.json({ playerstats: { success: true, steamID: "other", achievements: [] } }), { status: "unavailable" }],
    [Response.json({ playerstats: { success: true, achievements: [
      { apiname: "DUPLICATE", achieved: 0 }, { apiname: "DUPLICATE", achieved: 1 },
    ] } }), { status: "unavailable" }],
  ];
  for (const [response, expected] of cases) {
    assert.deepEqual(await fetchSteamAchievements(steamId, "620", "test-key", async () => response), expected);
  }
});
