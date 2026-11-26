import assert from "node:assert/strict";
import { test } from "node:test";

import { advisorMatchesSchema, advisorToolName, readInterpretation, resolveDuration } from "../src/features/advisor/model.ts";

function response(args, name = advisorToolName) {
  return { status: "completed", output: [{ type: "function_call", name, arguments: JSON.stringify(args) }] };
}

test("Accepte seulement un appel de l’outil de bibliothèque et des arguments validés", () => {
  const plan = { intent: "abandoned", durationText: "5 heures" };
  assert.deepEqual(readInterpretation(response(plan)), plan);
  for (const intent of ["resume", "similar_rated"]) {
    assert.deepEqual(readInterpretation(response({ intent, durationText: null })), { intent, durationText: null });
  }
  assert.equal(readInterpretation(response(plan, "unknown_tool")), null);
  assert.equal(readInterpretation(response({ ...plan, game: "Titre ajouté par le modèle" })), null);
  assert.equal(readInterpretation({ status: "incomplete", output: response(plan).output }), null);
  assert.equal(readInterpretation({ ...response(plan), output: [...response(plan).output, ...response(plan).output] }), null);
});

test("Convertit un refus du modèle en état local sans afficher son texte", () => {
  assert.deepEqual(readInterpretation({
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "Texte externe" }] }],
  }), { intent: "unsupported", durationText: null });
});

test("Calcule les durées à partir de la question utilisateur", () => {
  const session = { intent: "session", durationText: null };
  assert.equal(resolveDuration("J’ai 45 minutes, à quoi jouer ?", session), 45);
  assert.equal(resolveDuration("J’ai 1 h 30 devant moi.", session), 90);
  assert.equal(resolveDuration("J’ai 1,5 h devant moi.", session), 90);
  assert.equal(resolveDuration("Que puis-je jouer ?", session), null);
  assert.equal(resolveDuration("Jeux abandonnés après moins de 15 heures ?", {
    intent: "abandoned", durationText: "5 heures",
  }), 900);
});

test("Demande une clarification sur les seuils et formats ambigus", () => {
  assert.equal(resolveDuration("J’ai 30 min ou 1 h.", { intent: "session", durationText: "30 min" }), "ambiguous");
  assert.equal(resolveDuration("Jeux abandonnés après plus de 5 heures ?", {
    intent: "abandoned", durationText: "5 heures",
  }), "ambiguous");
  assert.equal(resolveDuration("Jeux abandonnés après moins de cinq heures ?", {
    intent: "abandoned", durationText: "cinq heures",
  }), "ambiguous");
});

test("Préserve la différence entre zéro et un temps de jeu indisponible", () => {
  const game = {
    id: "00000000-0000-4000-8000-000000000101", title: "Orbite", favorite: false, status: null, matchedGenres: [],
  };
  const matches = advisorMatchesSchema.parse({ total: 2, games: [
    { ...game, minutesPlayed: 0 },
    { ...game, id: "00000000-0000-4000-8000-000000000102", minutesPlayed: null },
  ] });
  assert.deepEqual(matches.games.map(({ minutesPlayed }) => minutesPlayed), [0, null]);
  assert.deepEqual(matches.games[0].ratedReferences, []);
  assert.equal(matches.games[0].favoriteGenreMatch, false);
});
