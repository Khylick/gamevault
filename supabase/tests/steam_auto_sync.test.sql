BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(15);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) SELECT id FROM auth.users WHERE email IN ('ada@example.test', 'bob@example.test');
INSERT INTO public.steam_accounts (user_id, steam_id) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '76561197960265729'),
    ('00000000-0000-4000-8000-0000000000b2', '76561197960265730');

SET LOCAL ROLE service_role;
SELECT is_empty('SELECT * FROM public.reserve_steam_auto_sync_batch()', 'Aucun compte ne peut être réservé par défaut');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
SELECT is((SELECT auto_sync_enabled FROM public.steam_accounts), FALSE, 'La synchronisation automatique doit être activée volontairement');
SELECT ok(public.set_steam_auto_sync(TRUE), 'Le compte peut activer sa synchronisation automatique');
SELECT ok(NOT has_function_privilege(current_user, 'public.reserve_steam_auto_sync_batch()', 'EXECUTE'),
    'Seul le serveur peut réserver un lot');
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is((SELECT auto_sync_enabled FROM public.steam_accounts), FALSE, 'Le réglage ne s’applique pas aux autres comptes');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT results_eq('SELECT steam_id FROM public.reserve_steam_auto_sync_batch()', ARRAY['76561197960265729'::TEXT],
    'Seul le compte activé est sélectionné');
SELECT is_empty('SELECT * FROM public.reserve_steam_auto_sync_batch()', 'Le lot consomme la réservation de la journée');
SELECT is(public.sync_steam_library(
    '00000000-0000-4000-8000-0000000000a1', '76561197960265729', statement_timestamp(),
    '[{"external_id":"620","name":"Portal 2","playtime_minutes":50}]'::JSONB,
    (SELECT auto_sync_attempted_at FROM public.steam_accounts WHERE steam_id = '76561197960265729')
), 'synced', 'La réservation valide peut écrire une observation');
SELECT is((SELECT auto_sync_result FROM public.steam_accounts WHERE steam_id = '76561197960265729'), 'steam-synced',
    'L’import réussi enregistre son résultat dans la même transaction');
SELECT is(
    public.finish_steam_auto_sync('00000000-0000-4000-8000-0000000000a1',
        (SELECT auto_sync_attempted_at FROM public.steam_accounts WHERE steam_id = '76561197960265729'), 'service-error'),
    NULL::BOOLEAN, 'Une tentative finalisée ne peut plus être écrasée');

UPDATE public.steam_accounts SET auto_sync_attempted_at = statement_timestamp() - INTERVAL '1 day'
WHERE steam_id = '76561197960265729';
SELECT results_eq('SELECT steam_id FROM public.reserve_steam_auto_sync_batch()', ARRAY['76561197960265729'::TEXT],
    'Le compte est de nouveau éligible un autre jour');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
SELECT ok(public.set_steam_auto_sync(FALSE), 'Le compte peut interrompre la synchronisation automatique');
SELECT is((SELECT auto_sync_result FROM public.steam_accounts), 'cancelled', 'La désactivation annule la réservation en cours');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(public.sync_steam_library(
    '00000000-0000-4000-8000-0000000000a1', '76561197960265729', statement_timestamp(),
    '[{"external_id":"620","name":"Portal 2","playtime_minutes":60}]'::JSONB,
    (SELECT auto_sync_attempted_at FROM public.steam_accounts WHERE steam_id = '76561197960265729')
), 'missing', 'Une requête interrompue ne peut plus écrire dans la bibliothèque');
SELECT is((SELECT playtime_minutes FROM public.user_games), 50, 'Le dernier relevé réussi est conservé');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
