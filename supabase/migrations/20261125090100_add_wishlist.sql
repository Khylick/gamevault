CREATE TABLE public.wishlist (
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
    PRIMARY KEY (user_id, game_id)
);

CREATE INDEX wishlist_user_created_idx ON public.wishlist (user_id, created_at DESC, game_id);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wishlist FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.wishlist TO authenticated;
GRANT INSERT ON TABLE public.wishlist TO service_role;
GRANT SELECT (user_id, game_id) ON TABLE public.wishlist TO service_role;

CREATE POLICY wishlist_read_own ON public.wishlist
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY wishlist_delete_own ON public.wishlist
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE VIEW public.wishlist_entries WITH (security_invoker = TRUE) AS
SELECT wish.user_id, wish.game_id, wish.created_at, game.name, game.platform, game.external_id, game.cover_url,
    owned.game_id IS NOT NULL AS owned
FROM public.wishlist AS wish
JOIN public.games AS game ON game.id = wish.game_id
LEFT JOIN public.user_games AS owned ON owned.user_id = wish.user_id AND owned.game_id = wish.game_id;

REVOKE ALL ON TABLE public.wishlist_entries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.wishlist_entries TO authenticated;

CREATE FUNCTION public.save_steam_wish(p_user_id UUID, p_app_id TEXT, p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    catalog_game_id UUID;
BEGIN
    IF p_app_id IS NULL OR p_app_id !~ '^[1-9][0-9]{0,9}$' THEN
        RETURN FALSE;
    END IF;
    IF p_app_id::BIGINT > 4294967295 THEN
        RETURN FALSE;
    END IF;

    IF p_name IS NOT NULL THEN
        INSERT INTO public.games (platform, external_id, name)
        VALUES ('steam', p_app_id, p_name)
        ON CONFLICT (platform, external_id) DO NOTHING;
    END IF;

    SELECT id INTO catalog_game_id
    FROM public.games
    WHERE platform = 'steam' AND external_id = p_app_id;
    IF catalog_game_id IS NULL THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.users (id) VALUES (p_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.wishlist (user_id, game_id) VALUES (p_user_id, catalog_game_id)
    ON CONFLICT (user_id, game_id) DO NOTHING;
    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_steam_wish(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_steam_wish(UUID, TEXT, TEXT) TO service_role;

ALTER TABLE gamevault_private.external_request_limits
    DROP CONSTRAINT external_request_limits_operation_check,
    ADD CONSTRAINT external_request_limits_operation_check CHECK (operation IN ('advisor', 'steam_sync', 'steam_wishlist'));

CREATE OR REPLACE FUNCTION public.claim_external_request(p_user_id UUID, p_operation TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    current_hour TIMESTAMPTZ := date_trunc('hour', statement_timestamp(), 'UTC');
    request_limit INTEGER := CASE p_operation WHEN 'advisor' THEN 30 WHEN 'steam_sync' THEN 10 WHEN 'steam_wishlist' THEN 20 END;
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
