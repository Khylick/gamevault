BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(46);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'ada@example.test'),
    ('00000000-0000-4000-8000-0000000000b2', 'bob@example.test');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

SELECT throws_ok(
    $$INSERT INTO public.users (id, display_name) VALUES ('00000000-0000-4000-8000-0000000000b2', 'Bob')$$,
    '42501', NULL, 'Un utilisateur ne crée pas le profil d’un autre compte'
);
SELECT lives_ok(
    $$INSERT INTO public.users (id, display_name) VALUES ('00000000-0000-4000-8000-0000000000a1', 'Ada')$$,
    'Un utilisateur crée son profil'
);

RESET ROLE;
SET LOCAL ROLE service_role;

INSERT INTO public.users (id, display_name)
VALUES ('00000000-0000-4000-8000-0000000000b2', 'Bob');

INSERT INTO public.steam_accounts (user_id, steam_id) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '76561197960265729'),
    ('00000000-0000-4000-8000-0000000000b2', '76561197960265730');

INSERT INTO public.games (id, platform, external_id, name) VALUES
    ('00000000-0000-4000-8000-000000000101', 'steam', '1000', 'Orbite'),
    ('00000000-0000-4000-8000-000000000102', 'steam', '2000', 'Dérive'),
    ('00000000-0000-4000-8000-000000000103', 'gog', '1000', 'Traversée');

INSERT INTO public.user_games (user_id, game_id, playtime_minutes, recent_playtime_minutes) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 0, 0),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', 200, 120),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000102', NULL, NULL);

INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes) VALUES
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', '2026-11-24 08:00+00', 0),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', '2026-11-24 08:00+00', 200);

INSERT INTO public.backlog_items (user_id, game_id, status) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', 'paused');

INSERT INTO public.collections (user_id, id, name) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000201', 'À reprendre');

INSERT INTO public.collection_games (user_id, collection_id, game_id) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101');

INSERT INTO public.user_reviews (user_id, game_id, rating) VALUES
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000101', 8);

SELECT throws_ok(
    $$INSERT INTO public.games (platform, external_id, name) VALUES ('steam', '1000', 'Doublon')$$,
    '23505', NULL, 'L’identifiant externe est unique au sein de sa plateforme'
);
SELECT throws_ok(
    $$UPDATE public.steam_accounts SET steam_id = '76561197960265729' WHERE user_id = '00000000-0000-4000-8000-0000000000b2'$$,
    '23505', NULL, 'Un compte Steam ne peut être lié qu’à un utilisateur'
);
SELECT throws_ok(
    $$UPDATE public.steam_accounts SET steam_id = '18446744073709551616'$$,
    '23514', NULL, 'Le SteamID64 hors plage est refusé'
);
SELECT throws_ok(
    $$UPDATE public.user_games SET playtime_minutes = -1$$,
    '23514', NULL, 'Les durées de jeu négatives sont refusées'
);
SELECT throws_ok(
    $$UPDATE public.user_games SET recent_playtime_minutes = 999 WHERE playtime_minutes IS NOT NULL$$,
    '23514', NULL, 'Le temps récent ne dépasse pas le total connu'
);
SELECT throws_ok(
    $$INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes) VALUES
      ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', '2026-11-25 00:30+02', 0)$$,
    '23505', NULL, 'Deux observations du même jour UTC se heurtent à la clé'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT is((SELECT count(*) FROM public.users), 1::BIGINT, 'Ada voit uniquement son profil');
SELECT is((SELECT steam_id FROM public.steam_accounts), '76561197960265729', 'Ada voit uniquement son SteamID64');
SELECT is((SELECT count(*) FROM public.games), 3::BIGINT, 'Le catalogue est partagé entre comptes authentifiés');
SELECT is((SELECT count(*) FROM public.user_games), 1::BIGINT, 'Ada voit uniquement sa bibliothèque');
SELECT is((SELECT playtime_minutes FROM public.game_playtime), 0, 'Ada voit uniquement son observation de jeu');
SELECT is((SELECT count(*) FROM public.backlog_items), 0::BIGINT, 'Le backlog de Bob reste privé');
SELECT is((SELECT count(*) FROM public.collections), 0::BIGINT, 'La collection de Bob reste privée');
SELECT is((SELECT count(*) FROM public.collection_games), 0::BIGINT, 'Les liens de Bob restent privés');
SELECT is((SELECT count(*) FROM public.user_reviews), 0::BIGINT, 'L’avis de Bob reste privé');

SELECT lives_ok(
    $$UPDATE public.users SET display_name = 'Adèle'$$,
    'Ada modifie son profil'
);
SELECT ok((SELECT display_name = 'Adèle' AND updated_at > created_at FROM public.users), 'La modification met à jour le profil et son horodatage');
SELECT lives_ok(
    $$UPDATE public.user_games SET favorite = TRUE$$,
    'Ada peut ajouter un favori'
);
SELECT is((SELECT favorite FROM public.user_games), TRUE, 'Le favori est enregistré');
SELECT throws_ok(
    $$UPDATE public.user_games SET playtime_minutes = 900$$,
    '42501', NULL, 'Le client ne peut pas écrire le temps synchronisé'
);
SELECT throws_ok(
    $$UPDATE public.steam_accounts SET steam_id = '76561197960265731'$$,
    '42501', NULL, 'Le client ne peut pas s’attribuer un compte Steam'
);
SELECT throws_ok(
    $$INSERT INTO public.games (platform, external_id, name) VALUES ('steam', '3000', 'Non autorisé')$$,
    '42501', NULL, 'Le client ne peut pas enrichir le catalogue'
);

SELECT lives_ok(
    $$INSERT INTO public.backlog_items (user_id, game_id, status, priority)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 'playing', 3)$$,
    'Ada ajoute un jeu à son backlog'
);
SELECT throws_ok(
    $$UPDATE public.backlog_items SET started_on = '2026-11-24', finished_on = '2026-11-23'$$,
    '23514', NULL, 'La fin ne précède pas le début'
);
SELECT lives_ok(
    $$UPDATE public.backlog_items SET status = 'completed', finished_on = '2026-11-24'$$,
    'Ada modifie le statut de son jeu'
);
SELECT is((SELECT status FROM public.backlog_items), 'completed', 'Le backlog reflète la modification');

SELECT lives_ok(
    $$INSERT INTO public.collections (user_id, id, name)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000202', 'Favoris')$$,
    'Ada crée une collection'
);
SELECT throws_ok(
    $$INSERT INTO public.collection_games (user_id, collection_id, game_id)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101')$$,
    '23503', NULL, 'Un lien ne peut pas viser la collection d’un autre utilisateur'
);
SELECT throws_ok(
    $$INSERT INTO public.collection_games (user_id, collection_id, game_id)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102')$$,
    '23503', NULL, 'Un lien requiert un jeu dans la bibliothèque du même utilisateur'
);
SELECT lives_ok(
    $$INSERT INTO public.collection_games (user_id, collection_id, game_id)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101')$$,
    'Ada ajoute un de ses jeux à sa collection'
);
SELECT throws_ok(
    $$INSERT INTO public.collections (user_id, name) VALUES ('00000000-0000-4000-8000-0000000000b2', 'Intrusion')$$,
    '42501', NULL, 'Ada ne peut pas écrire une collection au nom de Bob'
);
SELECT lives_ok($$DELETE FROM public.collections$$, 'Ada supprime ses collections visibles');
SELECT is((SELECT count(*) FROM public.collection_games), 0::BIGINT, 'Supprimer la collection supprime ses liens');

SELECT lives_ok(
    $$INSERT INTO public.user_reviews (user_id, game_id, rating)
      VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 7)$$,
    'Ada ajoute une note à un de ses jeux'
);
SELECT throws_ok(
    $$UPDATE public.user_reviews SET rating = 11$$,
    '23514', NULL, 'Une note supérieure à dix est refusée'
);
SELECT lives_ok(
    $$UPDATE public.user_reviews SET comment = 'À rejouer'$$,
    'Ada peut compléter sa note avec un commentaire'
);
SELECT is((SELECT comment FROM public.user_reviews), 'À rejouer', 'Le commentaire est enregistré');
SELECT lives_ok($$DELETE FROM public.user_reviews$$, 'Ada supprime ses avis visibles');

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';

SELECT is((SELECT count(*) FROM public.collections), 1::BIGINT, 'La suppression d’Ada laisse la collection de Bob intacte');
SELECT is((SELECT count(*) FROM public.user_games WHERE playtime_minutes IS NULL), 1::BIGINT, 'Un temps indisponible reste distinct de zéro');
SELECT is((SELECT rating FROM public.user_reviews), 8::SMALLINT, 'L’avis de Bob reste intact');
SELECT ok((SELECT bool_and(NOT favorite) FROM public.user_games), 'Les favoris d’Ada restent indépendants de ceux de Bob');

RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{}';

SELECT throws_ok(
    $$SELECT * FROM public.games$$,
    '42501', NULL, 'Le rôle anonyme ne peut pas lire le catalogue'
);
SELECT throws_ok(
    $$SELECT * FROM public.users$$,
    '42501', NULL, 'Le rôle anonyme ne peut pas lire les profils'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
