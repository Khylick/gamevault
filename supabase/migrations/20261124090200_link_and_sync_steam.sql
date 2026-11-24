CREATE TABLE gamevault_private.steam_link_challenges (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE gamevault_private.steam_link_challenges ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA gamevault_private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON gamevault_private.steam_link_challenges TO service_role;

CREATE FUNCTION public.issue_steam_link_challenge(p_user_id UUID, p_token_hash TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO gamevault_private.steam_link_challenges (user_id, token_hash, expires_at)
    VALUES (p_user_id, p_token_hash, statement_timestamp() + INTERVAL '10 minutes')
    ON CONFLICT (user_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at;
$$;

CREATE FUNCTION public.complete_steam_link(p_user_id UUID, p_token_hash TEXT, p_steam_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    DELETE FROM gamevault_private.steam_link_challenges
    WHERE user_id = p_user_id
        AND token_hash = p_token_hash
        AND expires_at > statement_timestamp();

    IF NOT FOUND THEN
        RETURN 'expired';
    END IF;

    INSERT INTO public.users (id) VALUES (p_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.steam_accounts (user_id, steam_id)
    VALUES (p_user_id, p_steam_id)
    ON CONFLICT DO NOTHING;

    IF EXISTS (
        SELECT 1 FROM public.steam_accounts
        WHERE user_id = p_user_id AND steam_id = p_steam_id
    ) THEN
        RETURN 'linked';
    END IF;

    RETURN 'conflict';
END;
$$;

CREATE FUNCTION public.sync_steam_library(
    p_user_id UUID, p_steam_id TEXT, p_observed_at TIMESTAMPTZ, p_games JSONB
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
    SET last_synced_at = p_observed_at
    WHERE user_id = p_user_id;

    RETURN 'synced';
END;
$$;

REVOKE EXECUTE ON FUNCTION
    public.issue_steam_link_challenge(UUID, TEXT),
    public.complete_steam_link(UUID, TEXT, TEXT),
    public.sync_steam_library(UUID, TEXT, TIMESTAMPTZ, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.issue_steam_link_challenge(UUID, TEXT),
    public.complete_steam_link(UUID, TEXT, TEXT),
    public.sync_steam_library(UUID, TEXT, TIMESTAMPTZ, JSONB)
TO service_role;
