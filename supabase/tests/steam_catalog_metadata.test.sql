BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');

INSERT INTO public.games (id, platform, external_id, name, description, genres) VALUES
    ('00000000-0000-4000-8000-000000000001', 'steam', '101', 'Premier jeu', NULL, ARRAY['Action']),
    ('00000000-0000-4000-8000-000000000002', 'steam', '102', 'Jeu complet', 'Description existante.', ARRAY['Simulation']),
    ('00000000-0000-4000-8000-000000000003', 'steam', '103', 'Jeu de Bob', NULL, '{}');
INSERT INTO public.user_games (user_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000002'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000003');

SET LOCAL ROLE service_role;

SELECT results_eq(
    $$SELECT external_id FROM public.reserve_steam_metadata_batch('00000000-0000-4000-8000-0000000000a1')$$,
    ARRAY['101'::TEXT], 'Seuls les jeux incomplets possédés par le compte sont réservés'
);
SELECT is_empty(
    $$SELECT * FROM public.reserve_steam_metadata_batch('00000000-0000-4000-8000-0000000000a1')$$,
    'Une fiche réservée ne peut pas être reprise pendant la même heure'
);
SELECT is(
    public.save_steam_metadata('00000000-0000-4000-8000-000000000001', statement_timestamp(), 'Hors réservation', ARRAY['Autre']),
    NULL::BOOLEAN, 'Une réservation périmée ne peut pas écrire la fiche'
);
SELECT ok(
    public.save_steam_metadata('00000000-0000-4000-8000-000000000001',
        (SELECT steam_metadata_retry_at FROM public.games WHERE external_id = '101'), 'Une description Steam.', ARRAY['Autre']),
    'Enregistre la description manquante'
);
SELECT is((SELECT description FROM public.games WHERE external_id = '101'), 'Une description Steam.', 'La description enrichie rejoint le catalogue');
SELECT is((SELECT genres FROM public.games WHERE external_id = '101'), ARRAY['Action'::TEXT], 'Le genre déjà présent est conservé');

SELECT results_eq(
    $$SELECT external_id FROM public.reserve_steam_metadata_batch('00000000-0000-4000-8000-0000000000b2')$$,
    ARRAY['103'::TEXT], 'Le second compte peut enrichir son propre jeu'
);
SELECT is(
    public.save_steam_metadata('00000000-0000-4000-8000-000000000003',
        (SELECT steam_metadata_retry_at FROM public.games WHERE external_id = '103'), NULL, '{}'),
    FALSE, 'Une fiche absente ne devient pas enrichie'
);
SELECT is_empty(
    $$SELECT * FROM public.reserve_steam_metadata_batch('00000000-0000-4000-8000-0000000000b2')$$,
    'Une absence côté Steam est réévaluée après le délai de reprise'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT ok(NOT has_function_privilege(current_user, 'public.reserve_steam_metadata_batch(uuid)', 'EXECUTE'),
    'La réservation reste réservée au serveur');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
