BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');
INSERT INTO public.users (id) VALUES
    ('00000000-0000-4000-8000-0000000000a1'),
    ('00000000-0000-4000-8000-0000000000b2');
INSERT INTO public.games (id, platform, external_id, name) VALUES
    ('00000000-0000-4000-8000-000000000101', 'steam', '1000', 'Orbite'),
    ('00000000-0000-4000-8000-000000000102', 'steam', '2000', 'Dérive');
INSERT INTO public.user_games (user_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000102');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

INSERT INTO public.game_journal_notes (user_id, game_id, content) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 'Note privée');
SELECT is((SELECT content FROM public.game_journal_notes), 'Note privée', 'La note peut être créée et relue');
SELECT is((SELECT created_at FROM public.game_journal_notes), now(), 'La note est datée automatiquement');
UPDATE public.game_journal_notes SET content = 'Note modifiée';
SELECT ok(
    (SELECT content = 'Note modifiée' AND created_at = now() FROM public.game_journal_notes),
    'La modification conserve la date de création'
);
SELECT throws_ok(
    $$UPDATE public.game_journal_notes SET content = E' \t\n'$$,
    '23514', NULL, 'Une note vide est refusée'
);
SELECT throws_ok(
    $$UPDATE public.game_journal_notes SET content = repeat('x', 2001)$$,
    '23514', NULL, 'Une note trop longue est refusée'
);
SELECT throws_ok(
    $$INSERT INTO public.game_journal_notes (user_id, game_id, content)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 'Note')$$,
    '23503', NULL, 'Le jeu doit appartenir à la bibliothèque du compte'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is_empty('SELECT content FROM public.game_journal_notes', 'Deux comptes possédant le même jeu ont des journaux privés');
WITH changed AS (UPDATE public.game_journal_notes SET content = 'Autre' RETURNING id)
SELECT is((SELECT count(*) FROM changed), 0::BIGINT, 'Un autre compte ne peut pas modifier la note');
WITH removed AS (DELETE FROM public.game_journal_notes RETURNING id)
SELECT is((SELECT count(*) FROM removed), 0::BIGINT, 'Un autre compte ne peut pas supprimer la note');

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
WITH removed AS (DELETE FROM public.game_journal_notes RETURNING id)
SELECT is((SELECT count(*) FROM removed), 1::BIGINT, 'Le propriétaire peut supprimer sa note');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
