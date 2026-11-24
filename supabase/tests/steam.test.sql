BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(25);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');

SET LOCAL ROLE authenticated;
SELECT ok(
    NOT has_function_privilege(current_user, 'public.issue_steam_link_challenge(uuid,text)', 'EXECUTE')
        AND NOT has_function_privilege(current_user, 'public.complete_steam_link(uuid,text,text)', 'EXECUTE')
        AND NOT has_function_privilege(current_user, 'public.sync_steam_library(uuid,text,timestamptz,jsonb)', 'EXECUTE'),
    'Le client authentifié ne peut exécuter aucune opération de synchronisation privilégiée'
);
RESET ROLE;

SET LOCAL ROLE service_role;

SELECT lives_ok(
    $$SELECT public.issue_steam_link_challenge('00000000-0000-4000-8000-0000000000a1', repeat('a', 64))$$,
    'Le serveur crée une demande de connexion Steam'
);
SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000b2', repeat('a', 64), '76561197960265729'),
    'expired', 'Une demande appartient au compte qui l’a initiée'
);
SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000a1', repeat('c', 64), '76561197960265729'),
    'expired', 'Le jeton doit correspondre à la demande'
);
SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000a1', repeat('a', 64), '76561197960265729'),
    'linked', 'Une demande valide associe le compte Steam au profil'
);
SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000a1', repeat('a', 64), '76561197960265729'),
    'expired', 'Une demande consommée ne peut pas être réutilisée'
);

SELECT public.issue_steam_link_challenge('00000000-0000-4000-8000-0000000000b2', repeat('b', 64));
SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000b2', repeat('b', 64), '76561197960265729'),
    'conflict', 'Une identité Steam liée ne peut pas être reprise par un autre compte'
);

SELECT public.issue_steam_link_challenge('00000000-0000-4000-8000-0000000000a1', repeat('d', 64));
SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000a1', repeat('d', 64), '76561197960265730'),
    'conflict', 'Une liaison existante ne peut pas être remplacée par une nouvelle assertion'
);
SELECT is((SELECT steam_id FROM public.steam_accounts), '76561197960265729', 'La liaison d’origine est préservée');

SELECT public.issue_steam_link_challenge('00000000-0000-4000-8000-0000000000b2', repeat('e', 64));
UPDATE gamevault_private.steam_link_challenges
SET expires_at = statement_timestamp() - INTERVAL '1 second'
WHERE user_id = '00000000-0000-4000-8000-0000000000b2';

SELECT is(
    public.complete_steam_link('00000000-0000-4000-8000-0000000000b2', repeat('e', 64), '76561197960265730'),
    'expired', 'Une demande au-delà du délai est refusée'
);
SELECT is(
    public.sync_steam_library('00000000-0000-4000-8000-0000000000b2', '76561197960265729', '2026-11-24 10:00+00', '[]'),
    'missing', 'Un import exige le couple compte GameVault et compte Steam associé'
);
SELECT is(
    public.sync_steam_library(
        '00000000-0000-4000-8000-0000000000a1', '76561197960265729', '2026-11-24 10:00+00',
        '[{"external_id":"100","name":"Orbite","playtime_minutes":120,"last_played_at":"2026-11-23T10:00:00Z"},{"external_id":"200","playtime_minutes":null}]'
    ),
    'synced', 'L’import crée les entrées du catalogue et de la bibliothèque'
);
SELECT is((SELECT count(*) FROM public.user_games), 2::BIGINT, 'Deux jeux appartiennent au profil synchronisé');
SELECT is((SELECT name FROM public.games WHERE external_id = '200'), 'Application Steam 200', 'L’application sans titre reste identifiable');
SELECT is((SELECT count(*) FROM public.game_playtime), 1::BIGINT, 'Seul le temps connu devient une observation');

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
UPDATE public.user_games SET favorite = TRUE WHERE playtime_minutes IS NOT NULL;
RESET ROLE;
SET LOCAL ROLE service_role;

SELECT is(
    public.sync_steam_library(
        '00000000-0000-4000-8000-0000000000a1', '76561197960265729', '2026-11-24 11:00+00',
        '[{"external_id":"100","playtime_minutes":180}]'
    ),
    'synced', 'Une observation ultérieure complète l’import du même jour'
);
SELECT is((SELECT name FROM public.games WHERE external_id = '100'), 'Orbite', 'Un titre manquant préserve le titre déjà connu');
SELECT is((SELECT count(*) FROM public.game_playtime), 1::BIGINT, 'Une seule observation est conservée par jour UTC');
SELECT is((SELECT playtime_minutes FROM public.game_playtime), 180, 'L’observation contient la mesure la plus récente');
SELECT is(
    public.sync_steam_library(
        '00000000-0000-4000-8000-0000000000a1', '76561197960265729', '2026-11-24 10:30+00',
        '[{"external_id":"100","name":"Orbite","playtime_minutes":150}]'
    ),
    'outdated', 'Un résultat plus ancien ne peut pas remplacer un import récent'
);
SELECT throws_ok(
    $$SELECT public.sync_steam_library(
        '00000000-0000-4000-8000-0000000000a1', '76561197960265729', '2026-11-24 12:00+00',
        '[{"external_id":"300","name":"Dérive","playtime_minutes":-5}]'
    )$$,
    '23514', NULL, 'Une mesure invalide annule toute la transaction'
);
SELECT is((SELECT count(*) FROM public.games WHERE external_id = '300'), 0::BIGINT, 'L’échec ne laisse aucune entrée partielle');
SELECT is(
    public.sync_steam_library('00000000-0000-4000-8000-0000000000a1', '76561197960265729', '2026-11-24 12:00+00', '[]'),
    'synced', 'Une bibliothèque vide explicitement confirmée est traitée'
);
SELECT is((SELECT count(*) FROM public.user_games), 2::BIGINT, 'Un jeu absent d’un import conserve ses données personnelles');
SELECT ok(
    (SELECT favorite AND playtime_minutes = 180 AND last_played_at = '2026-11-23 10:00+00'
    FROM public.user_games WHERE favorite),
    'Le favori et les mesures fiables survivent aux imports suivants'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
