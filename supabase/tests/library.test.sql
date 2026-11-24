BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(12);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');
INSERT INTO public.games (id, platform, external_id, name, genres) VALUES
    ('00000000-0000-4000-8000-000000000101', 'steam', '1000', 'Orbite', ARRAY['Action']),
    ('00000000-0000-4000-8000-000000000102', 'steam', '2000', 'Dérive', ARRAY['Stratégie']);
INSERT INTO public.user_games (user_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000102');
INSERT INTO public.user_reviews (user_id, game_id, comment) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', 'Avis privé');
INSERT INTO public.collections (user_id, id, name) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000201', 'Ada'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000203', 'Autre collection'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000202', 'Bob');
INSERT INTO public.collection_games (user_id, collection_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

SELECT is((SELECT count(*) FROM public.library_entries), 1::BIGINT, 'La vue ne montre que les jeux de sa bibliothèque');
SELECT is((SELECT comment FROM public.library_entries), NULL::TEXT, 'La vue masque les avis privés sur un jeu partagé');
SELECT is((SELECT genre FROM public.library_genres), 'Action', 'Les genres sont calculés sur la bibliothèque du profil');
SELECT is((SELECT count(*) FROM public.collection_library_entries), 0::BIGINT, 'Les membres des collections d’un autre compte restent privés');

SELECT lives_ok(
    $$SELECT public.save_library_progress('00000000-0000-4000-8000-000000000101', 'playing', 3::SMALLINT, 'Objectif', '2026-11-23', NULL)$$,
    'La progression peut être créée avec les droits de l’utilisateur'
);
SELECT lives_ok(
    $$SELECT public.set_library_status('00000000-0000-4000-8000-000000000101', 'paused')$$,
    'Le changement rapide met à jour une ligne existante'
);
SELECT ok(
    (SELECT status = 'paused' AND priority = 3 AND goals = 'Objectif' AND started_on = '2026-11-23' FROM public.library_entries),
    'Le changement de statut préserve la priorité, les objectifs et les dates'
);
SELECT throws_ok(
    $$SELECT public.set_library_status('00000000-0000-4000-8000-000000000102', 'completed')$$,
    '23503', NULL, 'Un statut requiert un jeu de la bibliothèque du profil'
);
SELECT lives_ok(
    $$SELECT public.save_library_review('00000000-0000-4000-8000-000000000101', 8::SMALLINT, 'Mon avis')$$,
    'L’utilisateur peut créer son avis sur le jeu'
);
SELECT lives_ok(
    $$SELECT public.save_library_review('00000000-0000-4000-8000-000000000101', 9::SMALLINT, 'Mon avis révisé')$$,
    'L’utilisateur peut modifier son avis existant'
);
SELECT is((SELECT comment FROM public.library_entries), 'Mon avis révisé', 'La vue reflète l’avis modifié');

INSERT INTO public.collection_games (user_id, collection_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101');
SELECT is(
    (SELECT count(*) FROM public.collection_library_entries), 2::BIGINT,
    'Un même jeu peut figurer dans plusieurs collections du même compte'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
