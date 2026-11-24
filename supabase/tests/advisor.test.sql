BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(18);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');

INSERT INTO public.games (id, platform, external_id, name, genres) VALUES
    ('00000000-0000-4000-8000-000000000101', 'steam', '101', 'Orbite', ARRAY['Simulation', 'Action']),
    ('00000000-0000-4000-8000-000000000102', 'steam', '102', 'Éclipse', ARRAY['simulation', 'Puzzle']),
    ('00000000-0000-4000-8000-000000000103', 'steam', '103', 'Dérive', '{}'),
    ('00000000-0000-4000-8000-000000000104', 'steam', '104', 'Balise', '{}'),
    ('00000000-0000-4000-8000-000000000105', 'steam', '105', 'Cendre', '{}'),
    ('00000000-0000-4000-8000-000000000106', 'steam', '106', 'Acier', '{}'),
    ('00000000-0000-4000-8000-000000000107', 'steam', '107', 'Azuré', '{}'),
    ('00000000-0000-4000-8000-000000000108', 'steam', '108', 'Jeu de Bob', ARRAY['Simulation']);

INSERT INTO public.user_games (user_id, game_id, playtime_minutes, last_played_at, favorite) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 300, now(), TRUE),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 20, now(), FALSE),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000103', 0, NULL, FALSE),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000104', 0, now(), FALSE),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000105', 299, now(), FALSE),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000106', 300, now(), FALSE),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000107', NULL, NULL, FALSE),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000108', 0, NULL, TRUE);

INSERT INTO public.backlog_items (user_id, game_id, status) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000105', 'abandoned'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000106', 'abandoned'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000107', 'abandoned');

SET LOCAL ROLE service_role;
INSERT INTO public.ai_conversations (id, user_id, question, answer) VALUES
    ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-0000000000a1', 'Question Ada', '{}'),
    ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-0000000000b2', 'Question Bob', '{}');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

SELECT is(public.advisor_library_matches('session')->>'total', '4', 'Les suggestions excluent les abandons et la bibliothèque de Bob');
SELECT is(public.advisor_library_matches('session')->'games'->0->>'title', 'Orbite', 'Le favori est préféré pour une session');
SELECT is(public.advisor_library_matches('unplayed')->>'total', '1', 'Zéro minute et une date absente identifient le jeu à explorer');
SELECT is(public.advisor_library_matches('unplayed')->'games'->0->>'title', 'Dérive', 'Une session connue exclut le jeu de ce filtre');
SELECT is(public.advisor_library_matches('abandoned', 300)->>'total', '1', 'Le seuil est strict et exige un temps connu');
SELECT is(public.advisor_library_matches('abandoned', 300)->'games'->0->>'minutesPlayed', '299', 'Le temps cumulé remonté est celui de la base');
SELECT is(public.advisor_library_matches('abandoned')->>'total', '3', 'Une demande sans seuil accepte le temps inconnu');
SELECT is(public.advisor_library_matches('similar')->>'total', '1', 'La similarité exclut les favoris déjà connus');
SELECT is(public.advisor_library_matches('similar')->'games'->0->'matchedGenres', '["simulation"]'::JSONB, 'La similarité expose le genre commun');
SELECT is(public.advisor_library_matches('relaxing')->>'total', '2', 'Les pistes calmes reposent sur des genres réels');
SELECT is(public.advisor_library_matches('completion')->>'total', '0', 'Une durée de complétion est hors des données interrogeables');

SELECT is((SELECT question FROM public.ai_conversations), 'Question Ada', 'L’historique d’Ada exclut celui de Bob');
SELECT throws_ok(
    $$INSERT INTO public.ai_conversations (user_id, question, answer)
      VALUES ('00000000-0000-4000-8000-0000000000a1', 'Réponse injectée', '{}')$$,
    '42501', NULL, 'Le client ne peut pas enregistrer de résultats arbitraires'
);
SELECT throws_ok(
    $$UPDATE public.ai_conversations SET question = 'Question modifiée'$$,
    '42501', NULL, 'Le client ne peut pas réécrire une réponse enregistrée'
);
SELECT is_empty(
    $$DELETE FROM public.ai_conversations WHERE id = '00000000-0000-4000-8000-000000000202' RETURNING id$$,
    'Ada ne peut pas supprimer une réponse de Bob'
);
SELECT lives_ok(
    $$DELETE FROM public.ai_conversations WHERE id = '00000000-0000-4000-8000-000000000201'$$,
    'Ada peut supprimer sa réponse'
);
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is((SELECT question FROM public.ai_conversations), 'Question Bob', 'La réponse de Bob reste accessible à Bob');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT ok(NOT has_function_privilege(current_user, 'public.advisor_library_matches(text,integer)', 'EXECUTE'), 'Un visiteur ne peut pas interroger la bibliothèque');
RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
