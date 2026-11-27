BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

INSERT INTO public.appearance_preferences (user_id, theme)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'ocean');
SELECT is((SELECT theme FROM public.appearance_preferences), 'ocean', 'Le compte peut enregistrer son thème');
UPDATE public.appearance_preferences SET theme = 'light';
SELECT is((SELECT theme FROM public.appearance_preferences), 'light', 'Le compte peut changer de thème');
SELECT throws_ok(
    $$UPDATE public.appearance_preferences SET theme = 'unknown'$$,
    '23514', NULL, 'Les thèmes inconnus sont refusés'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is_empty('SELECT theme FROM public.appearance_preferences', 'L’autre compte ne voit pas cette préférence');
SELECT throws_ok(
    $$INSERT INTO public.appearance_preferences VALUES ('00000000-0000-4000-8000-0000000000a1', 'midnight')
        ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme$$,
    '42501', NULL, 'L’autre compte ne peut pas remplacer cette préférence'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT ok(NOT has_table_privilege(current_user, 'public.appearance_preferences', 'SELECT'), 'Un visiteur ne peut pas lire les préférences');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
