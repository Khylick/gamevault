BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');
INSERT INTO public.games (id, platform, external_id, name, steam_release_year) VALUES
    ('00000000-0000-4000-8000-000000000001', 'steam', '101', 'Premier', 2011),
    ('00000000-0000-4000-8000-000000000002', 'steam', '102', 'Ex æquo', 2026),
    ('00000000-0000-4000-8000-000000000003', 'steam', '103', 'Troisième', 2026),
    ('00000000-0000-4000-8000-000000000004', 'steam', '104', 'Année inconnue', NULL),
    ('00000000-0000-4000-8000-000000000005', 'steam', '105', 'Commentaire seul', 2000);
INSERT INTO public.user_games (user_id, game_id)
SELECT '00000000-0000-4000-8000-0000000000a1', id FROM public.games WHERE external_id IN ('101', '102', '103', '104', '105');
INSERT INTO public.user_games (user_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001');

INSERT INTO public.user_reviews (user_id, game_id, rating, comment) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 9, NULL),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000002', 9, NULL),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000003', 7, NULL),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000004', 8, NULL),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000005', NULL, 'Mon commentaire.'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 10, NULL);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
SELECT is((SELECT ranking_year FROM public.personal_game_rankings WHERE external_id = '101'), 2011::SMALLINT, 'Une note ancienne utilise l’année Steam');
SELECT ok((SELECT uses_release_year FROM public.personal_game_rankings WHERE external_id = '101'), 'Le classement indique la provenance Steam');
SELECT is((SELECT ranking_year FROM public.personal_game_rankings WHERE external_id = '104'), NULL::SMALLINT, 'Une année inconnue reste absente');
SELECT is_empty($$SELECT * FROM public.personal_game_rankings WHERE external_id = '105'$$, 'Un commentaire sans note ne figure pas au classement');

SELECT public.save_library_review('00000000-0000-4000-8000-000000000001', 9::SMALLINT, NULL, 2026::SMALLINT);
SELECT is((SELECT ranking_year FROM public.personal_game_rankings WHERE external_id = '101'), 2026::SMALLINT, 'L’année de note a priorité');
SELECT is((SELECT uses_release_year FROM public.personal_game_rankings WHERE external_id = '101'), FALSE, 'Le classement indique que l’année vient de la note');
SELECT results_eq(
    $$SELECT ranking_position FROM public.personal_game_rankings WHERE ranking_year = 2026 ORDER BY external_id$$,
    ARRAY[1::BIGINT, 1::BIGINT, 3::BIGINT], 'Les ex æquo partagent leur rang et le rang suivant tient compte des deux jeux'
);
SELECT throws_ok(
    $$SELECT public.save_library_review('00000000-0000-4000-8000-000000000001', 9::SMALLINT, NULL, 2200::SMALLINT)$$,
    '23514', NULL, 'Une année hors plage est refusée'
);
SELECT public.save_library_review('00000000-0000-4000-8000-000000000001', NULL::SMALLINT, 'Avis conservé.');
SELECT is((SELECT rating_year FROM public.user_reviews WHERE game_id = '00000000-0000-4000-8000-000000000001'), NULL::SMALLINT,
    'L’ancienne fonction efface l’année si la note est retirée');

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is((SELECT count(*) FROM public.personal_game_rankings), 1::BIGINT, 'Chaque compte ne lit que ses propres notes');
SELECT is((SELECT rating FROM public.personal_game_rankings), 10::SMALLINT, 'Deux notes du même jeu restent privées');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
