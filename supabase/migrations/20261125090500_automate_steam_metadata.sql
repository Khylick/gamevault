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

CREATE TABLE gamevault_private.steam_metadata_schedule (
    singleton BOOLEAN PRIMARY KEY CHECK (singleton),
    hour_started_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE gamevault_private.steam_metadata_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE gamevault_private.steam_metadata_schedule FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE gamevault_private.steam_metadata_schedule TO service_role;

CREATE FUNCTION public.claim_steam_metadata_schedule()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    INSERT INTO gamevault_private.steam_metadata_schedule AS schedule (singleton, hour_started_at)
    VALUES (TRUE, date_trunc('hour', statement_timestamp(), 'UTC'))
    ON CONFLICT (singleton) DO UPDATE
    SET hour_started_at = EXCLUDED.hour_started_at
    WHERE schedule.hour_started_at < EXCLUDED.hour_started_at;

    RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_steam_metadata_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_steam_metadata_schedule() TO service_role;

CREATE FUNCTION public.steam_metadata_progress()
RETURNS TABLE (complete BIGINT, remaining BIGINT, deferred BIGINT)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH owned_games AS (
        SELECT
            NULLIF(btrim(game.description), '') IS NOT NULL AND cardinality(game.genres) > 0 AS ready,
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

REVOKE EXECUTE ON FUNCTION public.steam_metadata_progress() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.steam_metadata_progress() TO authenticated;
