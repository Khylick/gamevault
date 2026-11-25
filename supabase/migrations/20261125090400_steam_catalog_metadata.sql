ALTER TABLE public.games ADD COLUMN steam_metadata_retry_at TIMESTAMPTZ;

CREATE FUNCTION public.reserve_steam_metadata_batch(p_user_id UUID)
RETURNS TABLE (game_id UUID, external_id TEXT, reserved_until TIMESTAMPTZ)
LANGUAGE sql
SET search_path = ''
AS $$
    WITH candidates AS (
        SELECT game.id
        FROM public.user_games AS owned
        JOIN public.games AS game ON game.id = owned.game_id
        WHERE owned.user_id = p_user_id
            AND game.platform = 'steam'
            AND game.external_id ~ '^[1-9][0-9]{0,9}$'
            AND (length(game.external_id) < 10 OR game.external_id COLLATE "C" <= '4294967295')
            AND (NULLIF(btrim(game.description), '') IS NULL OR cardinality(game.genres) = 0)
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
    p_game_id UUID, p_reserved_until TIMESTAMPTZ, p_description TEXT, p_genres TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
SET search_path = ''
AS $$
    WITH reserved AS (
        SELECT id, NULLIF(btrim(description), '') IS NULL AS needs_description, cardinality(genres) = 0 AS needs_genres
        FROM public.games
        WHERE id = p_game_id AND platform = 'steam' AND steam_metadata_retry_at = p_reserved_until
        FOR UPDATE
    )
    UPDATE public.games AS game SET
        description = CASE WHEN reserved.needs_description THEN COALESCE(p_description, game.description) ELSE game.description END,
        genres = CASE WHEN reserved.needs_genres THEN COALESCE(p_genres, game.genres) ELSE game.genres END,
        steam_metadata_retry_at = statement_timestamp() + INTERVAL '30 days'
    FROM reserved
    WHERE game.id = reserved.id
    RETURNING (reserved.needs_description AND p_description IS NOT NULL)
        OR (reserved.needs_genres AND cardinality(COALESCE(p_genres, ARRAY[]::TEXT[])) > 0);
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_steam_metadata_batch(UUID),
    public.save_steam_metadata(UUID, TIMESTAMPTZ, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_steam_metadata_batch(UUID),
    public.save_steam_metadata(UUID, TIMESTAMPTZ, TEXT, TEXT[]) TO service_role;

ALTER TABLE gamevault_private.external_request_limits
    DROP CONSTRAINT external_request_limits_operation_check,
    ADD CONSTRAINT external_request_limits_operation_check CHECK (operation IN ('advisor', 'steam_sync', 'steam_wishlist', 'steam_achievements', 'steam_metadata'));

CREATE OR REPLACE FUNCTION public.claim_external_request(p_user_id UUID, p_operation TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    current_hour TIMESTAMPTZ := date_trunc('hour', statement_timestamp(), 'UTC');
    request_limit INTEGER := CASE p_operation WHEN 'advisor' THEN 30 WHEN 'steam_sync' THEN 10 WHEN 'steam_wishlist' THEN 20 WHEN 'steam_achievements' THEN 30 WHEN 'steam_metadata' THEN 8 END;
BEGIN
    IF request_limit IS NULL THEN
        RETURN FALSE;
    END IF;

    -- L’upsert réserve une demande sous le verrou de la ligne, même lors d’appels simultanés.
    INSERT INTO gamevault_private.external_request_limits AS usage (user_id, operation, hour_started_at, request_count)
    VALUES (p_user_id, p_operation, current_hour, 1)
    ON CONFLICT (user_id, operation) DO UPDATE
    SET hour_started_at = GREATEST(usage.hour_started_at, EXCLUDED.hour_started_at),
        request_count = CASE
            WHEN usage.hour_started_at < EXCLUDED.hour_started_at THEN 1
            ELSE usage.request_count + 1
        END
    WHERE usage.hour_started_at < EXCLUDED.hour_started_at OR usage.request_count < request_limit;

    RETURN FOUND;
END;
$$;
