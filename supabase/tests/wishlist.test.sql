BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(15);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');

SET LOCAL ROLE service_role;
SELECT ok(public.save_steam_wish('00000000-0000-4000-8000-0000000000a1', '42', 'Orbite'), 'Un compte sans profil Steam peut ajouter un jeu');
SELECT ok(public.save_steam_wish('00000000-0000-4000-8000-0000000000a1', '42', 'Titre concurrent'), 'Un ajout répété aboutit sans erreur');
SELECT ok(public.save_steam_wish('00000000-0000-4000-8000-0000000000b2', '42', NULL), 'Le second compte peut utiliser la même entrée du catalogue');
SELECT is(public.save_steam_wish('00000000-0000-4000-8000-0000000000a1', '43', NULL), FALSE, 'Un jeu absent exige un titre validé côté serveur');
SELECT is(public.save_steam_wish('00000000-0000-4000-8000-0000000000a1', '4294967296', 'Invalide'), FALSE, 'Un AppID hors plage est refusé');
SELECT is((SELECT name FROM public.games WHERE platform = 'steam' AND external_id = '42'), 'Orbite', 'La wishlist conserve les métadonnées existantes');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
SELECT is((SELECT count(*) FROM public.wishlist_entries), 1::BIGINT, 'Une seule entrée est visible et le second compte reste privé');
SELECT is((SELECT owned FROM public.wishlist_entries), FALSE, 'Le jeu souhaité est accessible sans être possédé');
SELECT ok(NOT has_function_privilege(current_user, 'public.save_steam_wish(uuid,text,text)', 'EXECUTE'), 'Seul le serveur peut enregistrer un jeu');
RESET ROLE;
INSERT INTO public.user_games (user_id, game_id)
SELECT '00000000-0000-4000-8000-0000000000a1', id FROM public.games WHERE platform = 'steam' AND external_id = '42';
SET LOCAL ROLE authenticated;
SELECT is((SELECT owned FROM public.wishlist_entries), TRUE, 'Un jeu acquis garde son entrée et devient accessible dans la bibliothèque');
WITH removed AS (
    DELETE FROM public.wishlist WHERE user_id = '00000000-0000-4000-8000-0000000000b2' RETURNING game_id
)
SELECT is(
    (SELECT count(*) FROM removed),
    0::BIGINT, 'Le premier compte ne peut pas retirer un jeu du second'
);
DELETE FROM public.wishlist WHERE user_id = '00000000-0000-4000-8000-0000000000a1';
SELECT is_empty('SELECT game_id FROM public.wishlist_entries', 'Le compte peut retirer sa propre entrée');
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
SELECT is((SELECT count(*) FROM public.wishlist_entries), 1::BIGINT, 'Le retrait laisse intacte la wishlist du second compte');
SELECT is((SELECT owned FROM public.wishlist_entries), FALSE, 'La possession du premier compte reste privée');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT ok(NOT has_table_privilege(current_user, 'public.wishlist_entries', 'SELECT'), 'La wishlist exige une session');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
