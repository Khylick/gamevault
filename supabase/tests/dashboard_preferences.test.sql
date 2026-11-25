BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(9);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

INSERT INTO public.dashboard_preferences (user_id, block_order, hidden_blocks)
VALUES ('00000000-0000-4000-8000-0000000000a1', ARRAY['metrics', 'hero', 'recent', 'top'], ARRAY['top']);
SELECT is((SELECT block_order[1] FROM public.dashboard_preferences), 'metrics', 'Le compte peut enregistrer son ordre');
SELECT is((SELECT hidden_blocks[1] FROM public.dashboard_preferences), 'top', 'La visibilité demeure indépendante de l’ordre');
SELECT throws_ok(
    $$UPDATE public.dashboard_preferences SET block_order = ARRAY['hero', 'hero', 'recent', 'top']$$,
    '23514', NULL, 'Les blocs dupliqués sont refusés'
);
SELECT throws_ok(
    $$INSERT INTO public.dashboard_preferences VALUES ('00000000-0000-4000-8000-0000000000b2', ARRAY['hero', 'metrics', 'recent', 'top'], '{}')$$,
    '42501', NULL, 'Le compte ne peut pas créer la disposition d’un autre utilisateur'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is_empty('SELECT * FROM public.dashboard_preferences', 'L’autre compte ne voit aucune préférence qui ne lui appartient pas');
WITH modified AS (
    UPDATE public.dashboard_preferences SET hidden_blocks = '{}' RETURNING user_id
)
SELECT is((SELECT count(*) FROM modified), 0::BIGINT, 'L’autre compte ne peut pas modifier la disposition');
WITH removed AS (
    DELETE FROM public.dashboard_preferences RETURNING user_id
)
SELECT is((SELECT count(*) FROM removed), 0::BIGINT, 'L’autre compte ne peut pas supprimer la disposition');

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
DELETE FROM public.dashboard_preferences;
SELECT is_empty('SELECT * FROM public.dashboard_preferences', 'Le compte peut supprimer sa personnalisation pour rétablir les valeurs par défaut');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT ok(NOT has_table_privilege(current_user, 'public.dashboard_preferences', 'SELECT'), 'Un visiteur anonyme ne peut pas consulter de préférences');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
