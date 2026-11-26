BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(13);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');

INSERT INTO public.games (id, platform, external_id, name, steam_release_year) VALUES
    ('00000000-0000-4000-8000-000000000101', 'steam', '101', 'Orbite', 2011),
    ('00000000-0000-4000-8000-000000000102', 'steam', '102', 'Éclipse', 2026),
    ('00000000-0000-4000-8000-000000000103', 'steam', '103', 'Dérive', 2025);
INSERT INTO public.user_games (user_id, game_id)
SELECT '00000000-0000-4000-8000-0000000000a1', id FROM public.games WHERE external_id IN ('101', '102', '103');
INSERT INTO public.user_games (user_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101');

INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes)
SELECT '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', observed_at, minutes
FROM (VALUES
    ('2025-12-31 08:00+00'::TIMESTAMPTZ, 190), ('2026-01-01 08:00+00', 240), ('2026-02-01 08:00+00', 300),
    ('2026-03-01 08:00+00', 290), ('2026-12-30 08:00+00', 320)
) AS observations (observed_at, minutes);
INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', '2024-04-01 08:00+00', 3),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', '2024-04-02 08:00+00', 3),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', '2026-01-01 08:00+00', 1),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', '2026-01-02 08:00+00', 1000);

INSERT INTO public.backlog_items (user_id, game_id, status, finished_on) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 'completed', '2026-01-21'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000103', 'completed', NULL);
INSERT INTO public.user_reviews (user_id, game_id, rating, rating_year) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 9, 2026),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 8, NULL),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000103', 7, NULL);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

SELECT is(public.annual_library_report(2026)->>'minutes', '90', 'Les écarts de l’année excluent la transition du Nouvel An et les baisses');
SELECT is(public.annual_library_report(2026)->>'corrections', '1', 'Une baisse de compteur est comptée à part');
SELECT is(public.annual_library_report(2026)->>'firstObservedOn', '2024-04-01', 'La couverture indique le premier relevé disponible du compte');
SELECT is(public.annual_library_report(2026)->>'firstSampleOn', '2026-01-01', 'La couverture de l’année commence au premier relevé annuel');
SELECT is(public.annual_library_report(2026)->>'lastSampleOn', '2026-12-30', 'La couverture de l’année se termine au dernier relevé annuel');
SELECT is(public.annual_library_report(2026)->'mostPlayed'->0->>'minutesPlayed', '90', 'Le classement d’activité utilise les écarts et non le temps cumulé');
SELECT is(jsonb_array_length(public.annual_library_report(2026)->'completed'), 1, 'Seul un jeu terminé avec une date dans l’année compte');
SELECT is(public.annual_library_report(2026)->'completed'->0->>'date', '2026-01-21', 'La date de fin affichée vient du backlog');
SELECT is(public.annual_library_report(2026)->'bestRated'->0->>'title', 'Orbite', 'Les notes reprennent le classement annuel');
SELECT is(public.annual_library_report(2025)->>'minutes', NULL::TEXT, 'Un seul relevé dans l’année ne devient pas zéro');
SELECT is(public.annual_library_report(2025)->'bestRated'->0->>'title', 'Dérive', 'Une année sans temps mesurable peut contenir une note');
SELECT is(public.annual_library_report(2024)->>'minutes', '0', 'Deux relevés identiques donnent zéro minute mesurée');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT ok(NOT has_function_privilege(current_user, 'public.annual_library_report(integer)', 'EXECUTE'),
    'Le bilan reste privé');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
