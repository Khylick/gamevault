import assert from "node:assert/strict";
import { URL } from "node:url";

const { fetch, Request, Response, Headers } = globalThis;

globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.href === "https://steamcommunity.com/openid/login") {
    assert.equal(options?.method, "POST");
    assert.equal(options.body.get("openid.mode"), "check_authentication");
    return new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n");
  }
  if (url.origin === "https://store.steampowered.com" && url.pathname === "/api/appdetails") {
    const id = url.searchParams.get("appids");
    assert.equal(url.searchParams.get("l"), "french");
    if (id === "4000000102") return Response.json({ [id]: { success: false } });
    assert.equal(id, "4000000101");
    return Response.json({ [id]: { success: true, data: {
      steam_appid: Number(id), short_description: "Explore une orbite inconnue.", genres: [{ description: "Aventure" }],
    } } });
  }
  if (url.origin === "https://api.steampowered.com") {
    assert.equal(new Headers(options.headers).get("x-webapi-key"), "fixture-only");
    if (url.pathname === "/ISteamUserStats/GetPlayerAchievements/v1/") {
      const appId = url.searchParams.get("appid");
      if (appId === "4000000102") {
        return Response.json({ playerstats: { success: false } }, { status: 400 });
      }
      assert.equal(appId, "4000000101");
      return Response.json({ playerstats: { success: true, achievements: [
        { apiname: "FIRST_FLIGHT", name: "Premier vol", achieved: 1, unlocktime: 1_795_523_400 },
        { apiname: "LANDING", name: "Atterrissage", achieved: 0, unlocktime: 0 },
      ] } });
    }
    if (url.pathname === "/IStoreService/GetAppList/v1/") {
      assert.equal(JSON.parse(url.searchParams.get("input_json")).last_appid, 4_000_000_102);
      return Response.json({ response: { apps: [{ appid: 4_000_000_103, name: "Horizon convoité" }] } });
    }
    if (url.pathname === "/IPlayerService/GetRecentlyPlayedGames/v1/") {
      return Response.json({ response: { total_count: 1, games: [{ appid: 4_000_000_101, playtime_2weeks: 30 }] } });
    }
    assert.equal(url.pathname, "/IPlayerService/GetOwnedGames/v1/");
    return Response.json({ response: { game_count: 2, games: [
      { appid: 4_000_000_101, name: "Orbite de test", playtime_forever: 180 },
      { appid: 4_000_000_102, name: "Jardin de test", playtime_forever: 0 },
    ] } });
  }
  if (url.href === "https://api.openai.com/v1/responses") {
    const body = JSON.parse(options.body);
    assert.equal(new Headers(options.headers).get("authorization"), "Bearer fixture-only");
    assert.equal(body.store, false);
    assert.deepEqual(body.tool_choice, { type: "function", name: "query_owned_library" });
    assert.doesNotMatch(JSON.stringify(body), /Orbite de test|Jardin de test|Note de test/);
    return Response.json({ status: "completed", output: [{
      type: "function_call",
      name: "query_owned_library",
      arguments: JSON.stringify({ intent: "unplayed", durationText: null }),
    }] });
  }
  return fetch(input, options);
};
