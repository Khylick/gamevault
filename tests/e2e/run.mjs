import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { openBrowser } from "./browser.mjs";
import { createLocalSession, localCronSecret, prepareLocalStack } from "./local.mjs";

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
  const dashboardOrder = 'Array.from(document.querySelectorAll("main [id^=dashboard-]"), (block) => block.id).join(",")';
  const editorPath = "/dashboard/personnaliser";
  const editorTitle = "Personnaliser le tableau de bord";
  await browser.viewport(390, 900);
  await browser.navigate("/", "Tableau de bord");
  await browser.wait(hasText("30\u00a0min sur 14 jours au dernier import."), "durée récente issue de Steam dans le tableau de bord");
  await browser.wait(hasText("Date inconnue"), "absence de date exacte de dernière session");
  assert.equal(await browser.evaluate(dashboardOrder), "dashboard-hero,dashboard-metrics,dashboard-recent,dashboard-top");
  await browser.evaluate(`document.querySelector('main a[href="${editorPath}"]').click()`);
  await browser.wait(hasText(editorTitle), "ouverture de la personnalisation du tableau de bord");
  await browser.evaluate(`(() => {
    const move = document.querySelector('button[aria-label="Monter Indicateurs de la bibliothèque"]');
    move.focus();
    move.click();
    [...document.querySelectorAll('main label')].find((label) => label.textContent.includes('Activité Steam récente')).querySelector('input').click();
  })()`);
  await browser.wait('document.querySelector("main li:first-child label").textContent.includes("Indicateurs")', "déplacement d’un bloc vers le haut");
  await browser.wait('document.activeElement.getAttribute("aria-label") === "Monter Indicateurs de la bibliothèque"', "focus conservé après déplacement");
  await browser.submit("Enregistrer la disposition");
  await browser.wait(dashboardOrder + ' === "dashboard-metrics,dashboard-hero,dashboard-top"', "ordre et visibilité personnalisés");
  await browser.viewport(1440, 950);
  await browser.navigate("/", "Tableau de bord");
  assert.equal(await browser.evaluate(dashboardOrder), "dashboard-metrics,dashboard-hero,dashboard-top");
  assert.equal(await browser.evaluate(`document.querySelector('#dashboard-hero a').getAttribute('href')`), "/library/" + gameId);
  await browser.viewport(390, 900);
  await browser.navigate("/settings", "Paramètres");
  await browser.submit("Enrichir les fiches Steam");
  await browser.wait(hasText("1 fiche enrichie."), "enrichissement d’un jeu déjà importé");
  await browser.wait(hasText("1 fiche prête · 1 à compléter"), "suivi de la progression de l’enrichissement");
  await browser.submit("Enrichir les fiches Steam");
  await browser.wait(hasText("Aucune fiche Steam à enrichir pour le moment."), "évite de refaire le même lot");
  await browser.navigate("/library", "Ma bibliothèque");
  await browser.wait(hasText("Orbite de test"), "jeu synchronisé dans la bibliothèque");
  assert.equal(await browser.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"), true);
  await browser.wait('[...document.querySelector(\'select[name="genre"]\').options].some((option) => option.value === "Aventure")',
    "le genre enrichi rejoint le filtre de bibliothèque");
  await browser.tab();
  await browser.wait('document.activeElement.hash === "#contenu"', "lien d’accès au contenu au clavier");
  await browser.navigate("/library/" + gameId, "Orbite de test");
  await browser.wait(hasText("Explore une orbite inconnue."), "description enrichie visible dans la fiche");
  await browser.wait(hasText("Temps sur 14 jours au dernier import"), "affichage de la période dans la fiche de jeu");
  await browser.wait(hasText("30\u00a0min"), "durée récente issue de Steam dans la fiche de jeu");
  assert.equal(await browser.evaluate(hasText("Premier vol")), false);
  await browser.submit("Charger mes succès");
  await browser.wait(hasText("1 / 2"), "nombre de succès débloqués");
  await browser.wait(hasText("Premier vol"), "succès Steam récupéré à la demande");
  await browser.wait(hasText("Verrouillé"), "distinction entre succès débloqués et verrouillés");
  await browser.submit("Enregistrer la progression", { status: "playing", priority: "3", goals: "Objectif de test" });
  await browser.wait(hasText("Progression enregistrée"), "mise à jour du backlog");
  await browser.submit("Enregistrer l’avis", { rating: "8", comment: "Note de test" });
  await browser.wait(hasText("Avis enregistré"), "enregistrement de l’avis");
  await browser.navigate("/classements", "Classements");
  await browser.wait('document.querySelector("#classement-2011")?.closest("section").innerText.includes("Orbite de test")',
    "classement selon l’année de sortie Steam");
  await browser.navigate("/library/" + gameId, "Orbite de test");
  await browser.submit("Enregistrer l’avis", { rating: "8", ratingYear: "2026", comment: "Note de test" });
  await browser.wait(hasText("Avis enregistré"), "enregistrement d’une année de note");
  await browser.navigate("/classements", "Classements");
  await browser.wait('document.querySelector("#classement-2026")?.closest("section").innerText.includes("Orbite de test")',
    "l’année choisie prime sur l’année Steam");
  assert.equal(await browser.evaluate('Boolean(document.querySelector("#classement-2011"))'), false);
  await browser.navigate("/library/" + gameId, "Orbite de test");
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

  const garden = await admin.from("games").select("id").eq("external_id", "4000000102").single();
  assert.equal(garden.error, null);
  await browser.navigate("/library/" + garden.data.id, "Jardin de test");
  await browser.submit("Charger mes succès");
  await browser.wait(hasText("Steam ne fournit pas les succès de ce jeu"), "message lorsque les succès sont inaccessibles");
  assert.equal((await admin.from("games").update({ genres: ["Aventure"] }).eq("id", garden.data.id)).error, null);
  await browser.submit("Enregistrer la progression", { status: "paused" });
  await browser.wait(hasText("Progression enregistrée"), "un jeu est mis en pause");

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
  await browser.navigate("/game-advisor", "Game Advisor");
  await browser.evaluate(`[...document.querySelectorAll('main button[type=button]')].find((button) => button.textContent.includes("devrais-je reprendre")).click()`);
  await browser.wait("document.querySelector('textarea').value.includes('devrais-je reprendre')", "saisie d’une demande de reprise");
  await browser.submit("Poser la question");
  await browser.wait(hasText("Jeux à reprendre dans ton backlog"), "réponse sur les jeux à reprendre");
  await browser.wait(hasText("En pause"), "le statut de reprise est expliqué");
  await browser.wait(hasText("Genres en commun avec Orbite de test (8/10)"), "le rapprochement cite une note enregistrée");
  await browser.navigate("/game-advisor", "Game Advisor");
  await browser.evaluate(`[...document.querySelectorAll('main button[type=button]')].find((button) => button.textContent.includes("le mieux notés")).click()`);
  await browser.wait("document.querySelector('textarea').value.includes('le mieux notés')", "saisie d’une demande liée aux meilleures notes");
  await browser.submit("Poser la question");
  await browser.wait(hasText("Jeux proches de tes meilleures notes"), "réponse sur les meilleures notes");
  await browser.wait(hasText("Genres en commun avec Orbite de test (8/10)"), "une recommandation cite le jeu le mieux noté");
  await browser.wait(`Boolean(document.querySelector('a[href="/library/${garden.data.id}"]'))`, "la recommandation renvoie à la fiche du jeu");
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
  assert.equal(privateGame.includes("Charger mes succès"), false);
  const privateRankings = await (await other.request("/classements")).text();
  assert.equal(privateRankings.includes("Orbite de test"), false);
  assert.ok(privateRankings.includes("Aucun jeu noté"));
  const privateWishlist = await (await other.request("/wishlist")).text();
  assert.equal(privateWishlist.includes("Horizon convoité"), false);
  const privateAnswer = await (await other.request(advisorPath)).text();
  assert.ok(privateAnswer.includes("Cette réponse est indisponible"));
  assert.equal(privateAnswer.includes("Jardin de test"), false);
  const otherDashboard = await (await other.request(editorPath)).text();
  assert.match(otherDashboard, /<li[^>]*>[\s\S]*?Mise en avant Steam/);
  assert.ok(otherDashboard.indexOf("Mise en avant Steam") < otherDashboard.indexOf("Indicateurs de la bibliothèque"));
  await browser.navigate(editorPath, editorTitle);
  await browser.evaluate(`document.querySelector('button[aria-label="Descendre Indicateurs de la bibliothèque"]').click()`);
  await browser.submit("Enregistrer la disposition");
  await browser.wait(dashboardOrder + ' === "dashboard-hero,dashboard-metrics,dashboard-top"', "mise à jour d’une disposition déjà enregistrée");
  await browser.navigate(editorPath, editorTitle);
  await browser.evaluate(`[...document.querySelectorAll('main button')].find((button) => button.textContent === 'Rétablir la disposition par défaut').click()`);
  await browser.submit("Enregistrer la disposition");
  await browser.wait(dashboardOrder + ' === "dashboard-hero,dashboard-metrics,dashboard-recent,dashboard-top"', "rétablissement de la disposition par défaut");
  assert.equal((await (await owner.request("/")).text()).includes('id="dashboard-recent"'), true);
  console.log("Isolation entre comptes, formulaires et graphiques validés dans Chrome à 390 et 1 440 px.");

  browser.close();
  browser = undefined;
  const cronUrl = stack.origin + "/api/cron/steam-metadata";
  assert.equal((await fetch(cronUrl)).status, 401);
  const scheduledGames = ["4000000104", "4000000105"].map((external_id) => ({
    id: randomUUID(), platform: "steam", external_id, name: "Jeu pour le planificateur",
  }));
  assert.equal((await admin.from("games").insert(scheduledGames)).error, null);
  const scheduledIds = scheduledGames.map(({ id }) => id);
  assert.equal((await admin.from("user_games").insert(scheduledIds.map((game_id) => ({ user_id: userId, game_id })))).error, null);
  const headers = { authorization: "Bearer " + localCronSecret };
  const cron = await fetch(cronUrl, { headers });
  assert.equal(cron.status, 200);
  assert.deepEqual(await cron.json(), { status: "retry-pending", reserved: 2, enriched: 1 });
  assert.deepEqual(await (await fetch(cronUrl, { headers })).json(), { status: "skipped" });
  const scheduledGame = await admin.from("games").select("description,genres,steam_release_year").eq("id", scheduledIds[0]).single();
  assert.equal(scheduledGame.error, null);
  assert.deepEqual(scheduledGame.data, { description: "Une fiche enrichie par le planificateur.", genres: ["Simulation"], steam_release_year: 2016 });
  const settingsAfterCron = await (await owner.request("/settings")).text();
  assert.match(settingsAfterCron.replace(/<!--.*?-->/g, ""), /2 fiches prêtes[\s\S]*?2 à compléter/);
  assert.equal((await admin.from("user_games").delete().eq("user_id", userId).in("game_id", scheduledIds)).error, null);
  await measureLargeLibrary(admin, owner, userId);

  const autoSyncUrl = stack.origin + "/api/cron/steam-sync";
  assert.equal((await fetch(autoSyncUrl)).status, 401);
  assert.deepEqual(await (await fetch(autoSyncUrl, { headers })).json(), { status: "completed", attempted: 0, succeeded: 0 });
  const enabled = await owner.submitSettings("Activer la synchronisation automatique", { enabled: "true" });
  assert.match(enabled.headers.get("location") ?? "", /notification=auto-sync-enabled/);
  assert.deepEqual(await (await fetch(autoSyncUrl, { headers })).json(), { status: "completed", attempted: 1, succeeded: 1 });
  assert.deepEqual(await (await fetch(autoSyncUrl, { headers })).json(), { status: "completed", attempted: 0, succeeded: 0 });
  assert.ok((await (await owner.request("/library?q=import%C3%A9")).text()).includes("Jeu importé automatiquement"));
  const afterAuto = await admin.from("user_games").select("playtime_minutes").eq("user_id", userId).eq("game_id", gameId).single();
  assert.equal(afterAuto.error, null);
  assert.equal(afterAuto.data.playtime_minutes, 195);
  const settingsAuto = await (await owner.request("/settings")).text();
  assert.ok(settingsAuto.includes("Dernier passage automatique"));
  assert.ok(settingsAuto.includes("Ta bibliothèque Steam a été synchronisée."));

  const previousDay = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal((await admin.from("steam_accounts").update({ auto_sync_attempted_at: previousDay }).eq("user_id", userId)).error, null);
  assert.deepEqual(await (await fetch(autoSyncUrl, { headers })).json(), { status: "completed", attempted: 1, succeeded: 0 });
  const privateSteam = await admin.from("steam_accounts").select("auto_sync_result").eq("user_id", userId).single();
  assert.equal(privateSteam.error, null);
  assert.equal(privateSteam.data.auto_sync_result, "library-inaccessible");
  assert.ok((await (await owner.request("/library?q=import%C3%A9")).text()).includes("Jeu importé automatiquement"));
  const disabled = await owner.submitSettings("Désactiver la synchronisation automatique", { enabled: "false" });
  assert.match(disabled.headers.get("location") ?? "", /notification=auto-sync-disabled/);
  assert.equal((await admin.from("steam_accounts").update({ auto_sync_attempted_at: previousDay }).eq("user_id", userId)).error, null);
  assert.deepEqual(await (await fetch(autoSyncUrl, { headers })).json(), { status: "completed", attempted: 0, succeeded: 0 });
} finally {
  browser?.close();
  await stack.stop();
}
