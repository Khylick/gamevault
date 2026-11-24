BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');

SET LOCAL ROLE service_role;

SELECT is(
    (SELECT count(*) FROM generate_series(1, 31) WHERE public.claim_external_request('00000000-0000-4000-8000-0000000000a1', 'advisor')),
    30::BIGINT, 'Game Advisor accepte trente demandes par heure et par compte'
);
SELECT is(
    (SELECT count(*) FROM generate_series(1, 11) WHERE public.claim_external_request('00000000-0000-4000-8000-0000000000a1', 'steam_sync')),
    10::BIGINT, 'La synchronisation a son propre compteur'
);
SELECT ok(public.claim_external_request('00000000-0000-4000-8000-0000000000b2', 'advisor'), 'Le second compte a son propre quota');
SELECT is(public.claim_external_request('00000000-0000-4000-8000-0000000000a1', 'unknown'), FALSE, 'Une opération inconnue est refusée');

UPDATE gamevault_private.external_request_limits
SET hour_started_at = hour_started_at - INTERVAL '1 hour'
WHERE user_id = '00000000-0000-4000-8000-0000000000a1' AND operation = 'advisor';
SELECT ok(public.claim_external_request('00000000-0000-4000-8000-0000000000a1', 'advisor'), 'Une nouvelle heure permet une nouvelle demande');
SELECT is(
    (SELECT request_count FROM gamevault_private.external_request_limits
     WHERE user_id = '00000000-0000-4000-8000-0000000000a1' AND operation = 'advisor'),
    1, 'Le compteur de la nouvelle heure repart à un'
);

UPDATE gamevault_private.external_request_limits
SET hour_started_at = date_trunc('hour', CURRENT_TIMESTAMP, 'UTC') + INTERVAL '2 hours'
WHERE user_id = '00000000-0000-4000-8000-0000000000a1' AND operation = 'advisor';
SELECT ok(public.claim_external_request('00000000-0000-4000-8000-0000000000a1', 'advisor'), 'Une demande arrivée en retard compte dans la fenêtre active');
SELECT is(
    (SELECT hour_started_at FROM gamevault_private.external_request_limits
     WHERE user_id = '00000000-0000-4000-8000-0000000000a1' AND operation = 'advisor'),
    date_trunc('hour', CURRENT_TIMESTAMP, 'UTC') + INTERVAL '2 hours',
    'Un appel arrivé dans le désordre ne rétablit pas une fenêtre expirée'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT ok(NOT has_function_privilege(current_user, 'public.claim_external_request(uuid,text)', 'EXECUTE'), 'Un client ne peut pas réserver directement un quota');
SELECT ok(NOT has_schema_privilege(current_user, 'gamevault_private', 'USAGE'), 'Le compteur reste inaccessible au client');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
