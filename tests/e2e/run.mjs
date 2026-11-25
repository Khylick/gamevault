import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { openBrowser } from "./browser.mjs";
import { createLocalSession, prepareLocalStack } from "./local.mjs";

const steamId = "76561197960265729";
const ownerEmail = "owner-e2e@example.com";
const otherEmail = "other-e2e@example.com";
const firstPassword = "Fixture-password-1!";
const newPassword = "Fixture-password-2!";
const { fetch, console } = globalThis;

async function updatePassword(session, password) {
  const updated = await session.submitSettings("Enregistrer le mot de passe", {
    password, passwordConfirmation: password,
  }, "/settings?mode=password");
  assert.match(updated.headers.get("location") ?? "", /notification=auth-password-updated/);
}

async function linkSteam(session, origin) {
  const start = await session.submitSettings("Connect with Steam");
  assert.equal(start.status, 303);
  const provider = new URL(start.headers.get("location"));
  assert.equal(provider.origin + provider.pathname, "https://steamcommunity.com/openid/login");
  assert.equal(provider.searchParams.get("openid.mode"), "checkid_setup");
  const returned = new URL(provider.searchParams.get("openid.return_to"));
  assert.equal(returned.origin, origin);
  assert.equal(returned.pathname, "/auth/steam/callback");
  assert.equal(session.cookies.get("gamevault_steam_state")?.httpOnly, true);

  const callback = new URL(returned);
  const identity = "https://steamcommunity.com/openid/id/" + steamId;
  for (const [key, value] of Object.entries({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.claimed_id": identity,
    "openid.identity": identity,
    "openid.return_to": returned.href,
    "openid.response_nonce": new Date().toISOString().replace(/\.\d{3}Z$/, "Z") + "fixture",
    "openid.assoc_handle": "fixture",
    "openid.signed": "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "fixture",
  })) callback.searchParams.set(key, value);
  const completed = await session.request(callback);
  assert.equal(completed.status, 303);
  assert.match(completed.headers.get("location") ?? "", /notification=steam-synced/);
  assert.equal(session.cookies.has("gamevault_steam_state"), false);
}

async function addPlaytimeHistory(admin, userId, gameId) {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
    now.getUTCDate() - ((now.getUTCDay() + 6) % 7), 12));
  const results = await admin.from("game_playtime").insert([
    { captured_at: new Date(+monday - 7 * 86_400_000).toISOString(), playtime_minutes: 60 },
    { captured_at: new Date(+monday - 4 * 86_400_000).toISOString(), playtime_minutes: 120 },
  ].map((row) => ({ user_id: userId, game_id: gameId, ...row })));
  assert.equal(results.error, null);
}

async function measureLargeLibrary(admin, session, userId) {
  const extraGames = 5_000;
  const batchSize = 250;
  for (let start = 0; start < extraGames; start += batchSize) {
    const entries = Array.from({ length: batchSize }, (_, index) => ({
      id: randomUUID(), platform: "steam", external_id: String(3_900_000_000 + start + index),
      name: "Entrée de volume " + (start + index), genres: ["Action"],
    }));
    assert.equal((await admin.from("games").insert(entries)).error, null);
    assert.equal((await admin.from("user_games").insert(entries.map(({ id }, index) => ({
      user_id: userId, game_id: id, playtime_minutes: index,
    })))).error, null);
  }

  for (const [label, path] of [
    ["Bibliothèque", "/library?view=list&sort=playtime"], ["Tableau de bord", "/"], ["Analytics", "/analytics"],
  ]) {
    const samples = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const started = performance.now();
      const response = await session.request(path);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.equal(html.includes("Erreur de chargement"), false);
      samples.push(performance.now() - started);
    }
    const median = Math.round(samples.toSorted((a, b) => a - b)[1]);
    console.log(label + " · médiane locale sur trois requêtes, " + median + " ms pour 5 002 jeux.");
  }
}

const stack = await prepareLocalStack();
let browser;
try {
  const visitor = await fetch(stack.origin + "/game-advisor");
  assert.equal(visitor.headers.get("x-frame-options"), "DENY");
  assert.equal(visitor.headers.get("x-content-type-options"), "nosniff");
  assert.equal(visitor.headers.get("x-powered-by"), null);
  assert.ok((await visitor.text()).includes("Connecte-toi à GameVault"));

  const admin = createClient(stack.config.API_URL, stack.config.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const existing = await admin.auth.admin.createUser({ email: ownerEmail, email_confirm: true });
  assert.equal(existing.error, null);
  const owner = createLocalSession(stack.origin);
  const recovery = await owner.submitSettings("Envoyer le lien de réinitialisation", {
    email: ownerEmail,
  }, "/settings?mode=forgot-password");
  assert.match(recovery.headers.get("location") ?? "", /notification=auth-recovery-sent/);
  await owner.followAuthEmail(stack.config, ownerEmail, "/settings?mode=password");
  await updatePassword(owner, firstPassword);
  await linkSteam(owner, stack.origin);
  await updatePassword(owner, newPassword);
  const signOut = await owner.submitSettings("Se déconnecter");
  assert.match(signOut.headers.get("location") ?? "", /notification=signed-out/);
  const outdated = await owner.submitSettings("Se connecter", { email: ownerEmail, password: firstPassword });
  assert.match(outdated.headers.get("location") ?? "", /notification=auth-invalid-credentials/);
  const signedIn = await owner.submitSettings("Se connecter", { email: ownerEmail, password: newPassword });
  assert.equal(signedIn.headers.get("location"), "/settings");
  assert.ok((await (await owner.request("/settings")).text()).includes(steamId));

  const account = await admin.from("steam_accounts").select("user_id").eq("steam_id", steamId).single();
  assert.equal(account.error, null);
  const userId = account.data.user_id;
  assert.equal(userId, existing.data.user.id);
  const game = await admin.from("games").select("id").eq("external_id", "4000000101").single();
  assert.equal(game.error, null);
  const gameId = game.data.id;
  await addPlaytimeHistory(admin, userId, gameId);
  console.log("Compte existant, récupération, changement de mot de passe et conservation de l’association Steam validés.");

  browser = await openBrowser(stack, owner.cookies);
  const hasText = (text) => "document.querySelector('main').innerText.includes(" + JSON.stringify(text) + ")";
  await browser.viewport(390, 900);
  await browser.navigate("/", "Tableau de bord");
  await browser.wait(hasText("30\u00a0min sur 14 jours au dernier import."), "durée récente issue de Steam dans le tableau de bord");
  await browser.wait(hasText("Date inconnue"), "absence de date exacte de dernière session");
  await browser.navigate("/library", "Ma bibliothèque");
  await browser.wait(hasText("Orbite de test"), "jeu synchronisé dans la bibliothèque");
  assert.equal(await browser.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"), true);
  await browser.tab();
  await browser.wait('document.activeElement.hash === "#contenu"', "lien d’accès au contenu au clavier");
  await browser.navigate("/library/" + gameId, "Orbite de test");
  await browser.wait(hasText("Temps sur 14 jours au dernier import"), "affichage de la période dans la fiche de jeu");
  await browser.wait(hasText("30\u00a0min"), "durée récente issue de Steam dans la fiche de jeu");
  await browser.submit("Enregistrer la progression", { status: "playing", priority: "3", goals: "Objectif de test" });
  await browser.wait(hasText("Progression enregistrée"), "mise à jour du backlog");
  await browser.submit("Enregistrer l’avis", { rating: "8", comment: "Note de test" });
  await browser.wait(hasText("Avis enregistré"), "enregistrement de l’avis");
  await browser.submit("Ajouter aux favoris");
  await browser.wait(hasText("Retirer des favoris"), "mise en favori");

  await browser.navigate("/collections", "Collections");
  await browser.submit("Créer la collection", { name: "Collection de test", description: "" });
  await browser.wait(hasText("Collection de test"), "création de collection");
  const collection = await admin.from("collections").select("id").eq("user_id", userId).single();
  assert.equal(collection.error, null);
  await browser.navigate("/library/" + gameId, "Orbite de test");
  await browser.submit("Ajouter", { collectionId: collection.data.id });
  await browser.wait(`Boolean(document.querySelector('main a[href="/collections/${collection.data.id}"]'))`, "jeu ajouté à la collection");
  await browser.navigate("/collections/" + collection.data.id, "Collection de test");
  await browser.wait(hasText("Orbite de test"), "jeu visible dans la collection");

  await browser.navigate("/wishlist", "Wishlist");
  await browser.submit("Ajouter à la wishlist", { steamApp: "https://store.steampowered.com/app/4000000103/" });
  await browser.wait(hasText("Horizon convoité"), "jeu hors bibliothèque ajouté à la wishlist");
  await browser.submit("Retirer de la wishlist");
  await browser.wait(hasText("Ta wishlist est vide"), "jeu retiré de la wishlist");
  await browser.submit("Ajouter à la wishlist", { steamApp: "4000000103" });
  await browser.wait(hasText("Horizon convoité"), "jeu du catalogue ajouté de nouveau à la wishlist");

  await browser.viewport(1440, 950);
  await browser.navigate("/analytics", "Statistiques");
  await browser.wait("document.querySelectorAll('.recharts-wrapper').length >= 2", "dessin des graphiques et de la progression");
  await browser.evaluate(`document.querySelector('a[href="/analytics?period=month"]').click()`);
  await browser.wait(hasText("Temps de jeu par mois"), "bascule sur le mois");
  await browser.navigate("/game-advisor", "Game Advisor");
  await browser.evaluate(`[...document.querySelectorAll('main button[type=button]')].find((button) => button.textContent.includes("jamais lancés")).click()`);
  await browser.wait("document.querySelector('textarea').value.includes('jamais lancés')", "saisie de la question");
  await browser.submit("Poser la question");
  await browser.wait(hasText("Jeux sans temps de jeu enregistré"), "réponse de Game Advisor");
  assert.equal(await browser.evaluate(hasText("Jardin de test")), true);
  assert.equal(await browser.evaluate(hasText("Orbite de test")), false);
  const advisorPath = await browser.evaluate("location.pathname + location.search");
  assert.match(advisorPath, /^\/game-advisor\?conversation=/);
  assert.deepEqual(browser.errors, []);

  const other = createLocalSession(stack.origin);
  const signup = await other.submitSettings("Créer mon compte", {
    email: otherEmail, password: firstPassword, passwordConfirmation: firstPassword,
  }, "/settings?mode=signup");
  assert.match(signup.headers.get("location") ?? "", /notification=auth-signup-sent/);
  assert.ok((await (await other.request("/settings")).text()).includes("Connexion à GameVault"));
  await other.followAuthEmail(stack.config, otherEmail, "/settings");
  assert.ok((await (await other.request("/settings")).text()).includes(otherEmail));
  const privateGame = await (await other.request("/library/" + gameId)).text();
  assert.equal(privateGame.includes("Orbite de test"), false);
  const privateWishlist = await (await other.request("/wishlist")).text();
  assert.equal(privateWishlist.includes("Horizon convoité"), false);
  const privateAnswer = await (await other.request(advisorPath)).text();
  assert.ok(privateAnswer.includes("Cette réponse est indisponible"));
  assert.equal(privateAnswer.includes("Jardin de test"), false);
  console.log("Isolation entre comptes, formulaires et graphiques validés dans Chrome à 390 et 1 440 px.");

  browser.close();
  browser = undefined;
  await measureLargeLibrary(admin, owner, userId);
} finally {
  browser?.close();
  await stack.stop();
}
