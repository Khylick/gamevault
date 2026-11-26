ALTER TABLE public.steam_accounts
    ADD COLUMN auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN auto_sync_attempted_at TIMESTAMPTZ,
    ADD COLUMN auto_sync_result TEXT CHECK (auto_sync_result IN (
        'running', 'cancelled', 'steam-synced', 'steam-empty', 'steam-outdated', 'steam-not-linked',
        'steam-api-key', 'steam-rate-limit', 'steam-invalid-library', 'library-inaccessible',
        'steam-unavailable', 'sync-rate-limit', 'service-error'
    ));

CREATE FUNCTION public.set_steam_auto_sync(p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    UPDATE public.steam_accounts
    SET auto_sync_enabled = p_enabled,
        auto_sync_result = CASE WHEN NOT p_enabled AND auto_sync_result = 'running' THEN 'cancelled' ELSE auto_sync_result END
    WHERE user_id = (SELECT auth.uid())
    RETURNING TRUE;
$$;

CREATE FUNCTION public.reserve_steam_auto_sync_batch()
RETURNS TABLE (user_id UUID, steam_id TEXT, attempted_at TIMESTAMPTZ)
LANGUAGE sql
SET search_path = ''
AS $$
    WITH candidates AS (
        SELECT account.user_id
        FROM public.steam_accounts AS account
        WHERE account.auto_sync_enabled AND (
            account.auto_sync_attempted_at IS NULL
            OR account.auto_sync_attempted_at < date_trunc('day', statement_timestamp(), 'UTC')
        )
        ORDER BY account.auto_sync_attempted_at NULLS FIRST, account.user_id
        LIMIT 3
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.steam_accounts AS account
    SET auto_sync_attempted_at = statement_timestamp(), auto_sync_result = 'running'
    FROM candidates
    WHERE account.user_id = candidates.user_id
    RETURNING account.user_id, account.steam_id, account.auto_sync_attempted_at;
$$;

CREATE FUNCTION public.finish_steam_auto_sync(p_user_id UUID, p_attempted_at TIMESTAMPTZ, p_result TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SET search_path = ''
AS $$
    UPDATE public.steam_accounts
    SET auto_sync_result = p_result
    WHERE user_id = p_user_id AND auto_sync_enabled
        AND auto_sync_attempted_at = p_attempted_at AND auto_sync_result = 'running'
    RETURNING TRUE;
$$;

REVOKE EXECUTE ON FUNCTION public.set_steam_auto_sync(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_steam_auto_sync(BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_steam_auto_sync_batch(),
    public.finish_steam_auto_sync(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_steam_auto_sync_batch(),
    public.finish_steam_auto_sync(UUID, TIMESTAMPTZ, TEXT) TO service_role;

CREATE FUNCTION public.sync_steam_library(
    p_user_id UUID, p_steam_id TEXT, p_observed_at TIMESTAMPTZ, p_games JSONB, p_auto_sync_attempted_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    previous_sync TIMESTAMPTZ;
BEGIN
    IF p_observed_at IS NULL OR jsonb_typeof(p_games) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid Steam sync payload' USING ERRCODE = '22023';
    END IF;

    -- Sérialise les imports d’un compte et écarte un résultat reçu dans le désordre.
    SELECT last_synced_at INTO previous_sync
    FROM public.steam_accounts
    WHERE user_id = p_user_id AND steam_id = p_steam_id
        AND (p_auto_sync_attempted_at IS NULL OR (
            auto_sync_enabled AND auto_sync_attempted_at = p_auto_sync_attempted_at AND auto_sync_result = 'running'
        ))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'missing';
    END IF;

    IF previous_sync >= p_observed_at THEN
        RETURN 'outdated';
    END IF;

    INSERT INTO public.games AS current_game (platform, external_id, name)
    SELECT 'steam', steam_game.external_id, COALESCE(steam_game.name, 'Application Steam ' || steam_game.external_id)
    FROM jsonb_to_recordset(p_games) AS steam_game (external_id TEXT, name TEXT)
    ORDER BY steam_game.external_id
    ON CONFLICT (platform, external_id) DO UPDATE
    SET name = EXCLUDED.name
    WHERE current_game.name IS DISTINCT FROM EXCLUDED.name
        AND EXCLUDED.name <> 'Application Steam ' || EXCLUDED.external_id;

    INSERT INTO public.user_games AS current_game (
        user_id, game_id, playtime_minutes, recent_playtime_minutes, last_played_at
    )
    SELECT p_user_id, game.id, steam_game.playtime_minutes, steam_game.recent_playtime_minutes, steam_game.last_played_at
    FROM jsonb_to_recordset(p_games) AS steam_game (
        external_id TEXT, playtime_minutes INTEGER, recent_playtime_minutes INTEGER, last_played_at TIMESTAMPTZ
    )
    INNER JOIN public.games AS game ON game.platform = 'steam' AND game.external_id = steam_game.external_id
    ON CONFLICT (user_id, game_id) DO UPDATE
    SET playtime_minutes = EXCLUDED.playtime_minutes,
        recent_playtime_minutes = EXCLUDED.recent_playtime_minutes,
        last_played_at = COALESCE(EXCLUDED.last_played_at, current_game.last_played_at);

    INSERT INTO public.game_playtime (user_id, game_id, captured_at, playtime_minutes)
    SELECT p_user_id, game.id, p_observed_at, steam_game.playtime_minutes
    FROM jsonb_to_recordset(p_games) AS steam_game (external_id TEXT, playtime_minutes INTEGER)
    INNER JOIN public.games AS game ON game.platform = 'steam' AND game.external_id = steam_game.external_id
    WHERE steam_game.playtime_minutes IS NOT NULL
    ON CONFLICT (user_id, game_id, captured_on) DO UPDATE
    SET captured_at = EXCLUDED.captured_at, playtime_minutes = EXCLUDED.playtime_minutes;

    UPDATE public.steam_accounts
    SET last_synced_at = p_observed_at,
        auto_sync_result = CASE
            WHEN p_auto_sync_attempted_at IS NULL THEN auto_sync_result
            WHEN jsonb_array_length(p_games) = 0 THEN 'steam-empty'
            ELSE 'steam-synced'
        END
    WHERE user_id = p_user_id;

    RETURN 'synced';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_steam_library(UUID, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_steam_library(UUID, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_steam_library(
    p_user_id UUID, p_steam_id TEXT, p_observed_at TIMESTAMPTZ, p_games JSONB
)
RETURNS TEXT
LANGUAGE sql
SET search_path = ''
AS $$
    SELECT public.sync_steam_library(p_user_id, p_steam_id, p_observed_at, p_games, NULL::TIMESTAMPTZ);
$$;
