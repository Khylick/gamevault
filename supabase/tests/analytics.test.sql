BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(22);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');
INSERT INTO public.games (id, platform, external_id, name, genres) VALUES
    ('00000000-0000-4000-8000-000000000101', 'steam', '101', 'Orbite', ARRAY['Action', 'RPG', 'Action']),
    ('00000000-0000-4000-8000-000000000102', 'steam', '102', 'Éclipse', ARRAY['RPG']),
    ('00000000-0000-4000-8000-000000000103', 'steam', '103', 'Dérive', '{}'),
    ('00000000-0000-4000-8000-000000000104', 'steam', '104', 'Jeu de Bob', ARRAY['Genre privé']);
INSERT INTO public.user_games (user_id, game_id, playtime_minutes, last_played_at, created_at) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 300, statement_timestamp() - INTERVAL '1 day', '2026-11-01'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 0, statement_timestamp() - INTERVAL '100 days', '2026-11-02'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000103', NULL, NULL, '2026-11-03'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', 900, statement_timestamp(), '2026-11-04'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000104', 500, statement_timestamp(), '2026-11-04');
INSERT INTO public.backlog_items (user_id, game_id, status) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 'playing'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 'completed'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000103', 'to_start');

INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes)
SELECT '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', observed_at, minutes
FROM (VALUES
    ('2026-09-30 08:00+00'::TIMESTAMPTZ, 10), ('2026-10-20 08:00+00', 30), ('2026-10-21 08:00+00', 30),
    ('2026-10-31 08:00+00', 50), ('2026-11-01 08:00+00', 70), ('2026-11-02 08:00+00', 100),
    ('2026-11-03 08:00+00', 100), ('2026-11-06 08:00+00', 130), ('2026-11-09 08:00+00', 170),
    ('2026-11-10 08:00+00', 160), ('2026-11-12 08:00+00', 180), ('2026-11-24 08:00+00', 200)
) AS fixture (observed_at, minutes);
INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', '2026-11-02 08:00+00', 10),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', '2026-11-03 08:00+00', 900);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

SELECT is(public.dashboard_summary()->>'gameCount', '3', 'Le tableau de bord compte les jeux du compte connecté');
SELECT is(public.dashboard_summary()->>'minutesPlayed', '300', 'Le temps connu est agrégé sans les durées du second compte');
SELECT is(public.dashboard_summary()->>'knownPlaytimeCount', '2', 'Une mesure nulle et une mesure inconnue restent distinctes');
SELECT is(public.dashboard_summary()->'counts', '{"backlog":1,"completed":1,"playing":1}'::JSONB, 'Les compteurs de statut correspondent aux données');
SELECT is(public.dashboard_summary()->'recentlyPlayed'->0->>'title', 'Orbite', 'Le jeu connu le plus récemment joué est en tête');
SELECT is(jsonb_array_length(public.dashboard_summary()->'mostPlayed'), 1, 'Le classement exclut les durées nulles et inconnues');

SELECT is(public.library_analytics()->'genreMinutes', '[{"label":"Action","minutes":300},{"label":"RPG","minutes":300}]'::JSONB, 'Un jeu contribue une fois à chacun de ses genres');
SELECT is(public.library_analytics()->>'taggedMinutes', '300', 'La couverture des genres compte chaque jeu une seule fois');
SELECT is(public.library_analytics()->'recentAdditions'->0->>'title', 'Dérive', 'Les ajouts sont triés par date d’import');
SELECT is(public.library_analytics()->'inactiveGames'->0->>'title', 'Éclipse', 'Les jeux délaissés exigent une ancienne date connue');
SELECT is(jsonb_array_length(public.library_analytics()->'inactiveGames'), 1, 'Une date manquante ne rend pas un jeu délaissé');

SELECT is((SELECT count(*) FROM public.playtime_history('week', '2026-11-24')), 8::BIGINT, 'Le graphique hebdomadaire couvre huit semaines');
SELECT is((SELECT minutes FROM public.playtime_history('week', '2026-11-24') WHERE period_start = '2026-10-19'), 0::BIGINT, 'Deux relevés identiques produisent un zéro observé');
SELECT is((SELECT minutes FROM public.playtime_history('week', '2026-11-24') WHERE period_start = '2026-11-02'), 30::BIGINT, 'Les écarts de la même semaine sont additionnés');
SELECT is((SELECT unallocated_minutes FROM public.playtime_history('week', '2026-11-24') WHERE period_start = '2026-11-02'), 30::BIGINT, 'Un écart à cheval reste sans attribution');
SELECT is((SELECT minutes FROM public.playtime_history('week', '2026-11-24') WHERE period_start = '2026-11-16'), NULL::BIGINT, 'Une période sans mesure reste inconnue');
SELECT is((SELECT corrections FROM public.playtime_history('week', '2026-11-24') WHERE period_start = '2026-11-09'), 1::BIGINT, 'Une baisse de compteur est isolée');
SELECT is((SELECT minutes FROM public.playtime_history('month', '2026-11-24') WHERE period_start = '2026-11-01'), 140::BIGINT, 'Le mois accepte les écarts qui traversent une semaine');
SELECT is((SELECT unallocated_minutes FROM public.playtime_history('month', '2026-11-24') WHERE period_start = '2026-11-01'), 20::BIGINT, 'Un écart entre deux mois reste sans attribution');
SELECT is((SELECT unallocated_minutes FROM public.playtime_history('week', '2026-11-24') WHERE period_start = '2026-10-19'), 20::BIGINT, 'Le relevé précédent peut précéder la fenêtre affichée');
SELECT is(jsonb_array_length(public.analytics_report('month')->'history'), 6, 'Le rapport réunit six mois et les agrégats du compte');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT ok(NOT has_function_privilege(current_user, 'public.analytics_report(text)', 'EXECUTE'), 'Le rôle anonyme ne peut pas lire le rapport');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
