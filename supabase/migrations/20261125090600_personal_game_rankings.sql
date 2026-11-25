ALTER TABLE public.games
    ADD COLUMN steam_release_year SMALLINT CHECK (steam_release_year BETWEEN 1900 AND 2100);

ALTER TABLE public.user_reviews
    ADD COLUMN rating_year SMALLINT CHECK (rating_year IS NULL OR (rating IS NOT NULL AND rating_year BETWEEN 1900 AND 2100));

GRANT INSERT (rating_year), UPDATE (rating_year) ON TABLE public.user_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.save_library_review(p_game_id UUID, p_rating SMALLINT, p_comment TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO public.user_reviews AS current_review (user_id, game_id, rating, comment)
    VALUES ((SELECT auth.uid()), p_game_id, p_rating, p_comment)
    ON CONFLICT (user_id, game_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment,
        rating_year = CASE WHEN EXCLUDED.rating IS NOT NULL THEN current_review.rating_year END;
$$;

CREATE FUNCTION public.save_library_review(p_game_id UUID, p_rating SMALLINT, p_comment TEXT, p_rating_year SMALLINT)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO public.user_reviews (user_id, game_id, rating, comment, rating_year)
    VALUES ((SELECT auth.uid()), p_game_id, p_rating, p_comment, p_rating_year)
    ON CONFLICT (user_id, game_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, rating_year = EXCLUDED.rating_year;
$$;

REVOKE EXECUTE ON FUNCTION public.save_library_review(UUID, SMALLINT, TEXT, SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_library_review(UUID, SMALLINT, TEXT, SMALLINT) TO authenticated;

CREATE OR REPLACE VIEW public.library_entries WITH (security_invoker = TRUE) AS
SELECT owned.user_id, owned.game_id, game.name, game.platform, game.external_id,
    game.description, game.cover_url, game.genres,
    owned.favorite, owned.playtime_minutes, owned.recent_playtime_minutes,
    owned.last_played_at, owned.created_at,
    backlog.status, backlog.priority, backlog.goals, backlog.started_on, backlog.finished_on,
    review.rating, review.comment, review.rating_year, game.steam_release_year
FROM public.user_games AS owned
INNER JOIN public.games AS game ON game.id = owned.game_id
LEFT JOIN public.backlog_items AS backlog USING (user_id, game_id)
LEFT JOIN public.user_reviews AS review USING (user_id, game_id);

CREATE VIEW public.personal_game_rankings WITH (security_invoker = TRUE) AS
SELECT user_id, game_id, name, platform, external_id, cover_url, rating,
    COALESCE(rating_year, steam_release_year) AS ranking_year,
    rating_year IS NULL AND steam_release_year IS NOT NULL AS uses_release_year,
    RANK() OVER (PARTITION BY user_id, COALESCE(rating_year, steam_release_year) ORDER BY rating DESC) AS ranking_position
FROM public.library_entries
WHERE rating IS NOT NULL AND user_id = (SELECT auth.uid());

REVOKE ALL ON TABLE public.personal_game_rankings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.personal_game_rankings TO authenticated;

-- Remet les anciennes fiches en attente de lecture tout en conservant les réservations en cours.
UPDATE public.games
SET steam_metadata_retry_at = NULL
WHERE platform = 'steam' AND steam_metadata_retry_at > statement_timestamp() + INTERVAL '1 hour';

CREATE OR REPLACE FUNCTION public.reserve_steam_metadata_batch(p_user_id UUID)
RETURNS TABLE (game_id UUID, external_id TEXT, reserved_until TIMESTAMPTZ)
LANGUAGE sql
SET search_path = ''
AS $$
    WITH candidates AS (
        SELECT game.id
        FROM public.games AS game
        WHERE game.platform = 'steam'
            AND EXISTS (
                SELECT 1 FROM public.user_games AS owned
                WHERE owned.game_id = game.id AND (p_user_id IS NULL OR owned.user_id = p_user_id)
            )
            AND game.external_id ~ '^[1-9][0-9]{0,9}$'
            AND (length(game.external_id) < 10 OR game.external_id COLLATE "C" <= '4294967295')
            AND (NULLIF(btrim(game.description), '') IS NULL OR cardinality(game.genres) = 0 OR game.steam_release_year IS NULL)
            AND (game.steam_metadata_retry_at IS NULL OR game.steam_metadata_retry_at <= statement_timestamp())
        ORDER BY game.steam_metadata_retry_at NULLS FIRST, game.id
        LIMIT 12
        FOR UPDATE OF game SKIP LOCKED
    )
    UPDATE public.games AS game
    SET steam_metadata_retry_at = statement_timestamp() + INTERVAL '1 hour'
    FROM candidates
    WHERE game.id = candidates.id
    RETURNING game.id, game.external_id, game.steam_metadata_retry_at;
$$;

CREATE FUNCTION public.save_steam_metadata(
    p_game_id UUID, p_reserved_until TIMESTAMPTZ, p_description TEXT, p_genres TEXT[], p_release_year SMALLINT
)
RETURNS BOOLEAN
LANGUAGE sql
SET search_path = ''
AS $$
    WITH reserved AS (
        SELECT id, NULLIF(btrim(description), '') IS NULL AS needs_description, cardinality(genres) = 0 AS needs_genres,
            steam_release_year IS NULL AS needs_release_year
        FROM public.games
        WHERE id = p_game_id AND platform = 'steam' AND steam_metadata_retry_at = p_reserved_until
        FOR UPDATE
    )
    UPDATE public.games AS game SET
        description = CASE WHEN reserved.needs_description THEN COALESCE(p_description, game.description) ELSE game.description END,
        genres = CASE WHEN reserved.needs_genres THEN COALESCE(p_genres, game.genres) ELSE game.genres END,
        steam_release_year = COALESCE(game.steam_release_year, p_release_year),
        steam_metadata_retry_at = statement_timestamp() + INTERVAL '30 days'
    FROM reserved
    WHERE game.id = reserved.id
    RETURNING (reserved.needs_description AND p_description IS NOT NULL)
        OR (reserved.needs_genres AND cardinality(COALESCE(p_genres, ARRAY[]::TEXT[])) > 0)
        OR (reserved.needs_release_year AND p_release_year IS NOT NULL);
$$;

REVOKE EXECUTE ON FUNCTION public.save_steam_metadata(UUID, TIMESTAMPTZ, TEXT, TEXT[], SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_steam_metadata(UUID, TIMESTAMPTZ, TEXT, TEXT[], SMALLINT) TO service_role;

CREATE OR REPLACE FUNCTION public.steam_metadata_progress()
RETURNS TABLE (complete BIGINT, remaining BIGINT, deferred BIGINT)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH owned_games AS (
        SELECT
            NULLIF(btrim(game.description), '') IS NOT NULL AND cardinality(game.genres) > 0 AND game.steam_release_year IS NOT NULL AS ready,
            game.steam_metadata_retry_at
        FROM public.user_games AS owned
        JOIN public.games AS game ON game.id = owned.game_id
        WHERE owned.user_id = (SELECT auth.uid()) AND game.platform = 'steam'
    )
    SELECT COUNT(*) FILTER (WHERE ready),
        COUNT(*) FILTER (WHERE NOT ready),
        COUNT(*) FILTER (WHERE NOT ready AND steam_metadata_retry_at > statement_timestamp())
    FROM owned_games;
$$;
