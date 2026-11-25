import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchSteamMetadata } from "../src/features/steam/catalog-metadata.ts";

const { Response } = globalThis;

test("Lit les genres du magasin Steam et traite la description comme du texte", async () => {
  const result = await fetchSteamMetadata("620", async (url, options) => {
    assert.equal(url.origin + url.pathname, "https://store.steampowered.com/api/appdetails");
    assert.equal(url.searchParams.get("appids"), "620");
    assert.equal(url.searchParams.get("l"), "french");
    assert.equal(options.redirect, "error");
    return Response.json({ 620: { success: true, data: {
      steam_appid: 620,
      short_description: "<p>Un &quot;jeu&quot; d&#39;énigmes.</p><p>A &amp; B.</p>",
      genres: [{ description: "Action" }, { description: " Aventure " }, { description: "Action" }],
    } } });
  });
  assert.deepEqual(result, { status: "available", description: 'Un "jeu" d\'énigmes. A & B.', genres: ["Action", "Aventure"] });
});

test("Vérifie l’AppID et distingue les données absentes d’une erreur temporaire", async () => {
  const cases = [
    [Response.json({ 620: { success: false } }), { status: "missing" }],
    [Response.json({ 620: { success: true, data: { steam_appid: 620 } } }),
      { status: "available", description: null, genres: [] }],
    [Response.json({ 620: { success: true, data: { steam_appid: 622 } } }), { status: "unavailable" }],
    [new Response(null, { status: 429 }), { status: "rate-limited" }],
    [new Response(null, { status: 503 }), { status: "unavailable" }],
  ];
  for (const [response, expected] of cases) {
    assert.deepEqual(await fetchSteamMetadata("620", async () => response), expected);
  }
});
