CREATE TABLE gamevault_private.external_request_limits (
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('advisor', 'steam_sync')),
    hour_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    PRIMARY KEY (user_id, operation)
);

ALTER TABLE gamevault_private.external_request_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gamevault_private.external_request_limits TO service_role;

CREATE FUNCTION public.claim_external_request(p_user_id UUID, p_operation TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    current_hour TIMESTAMPTZ := date_trunc('hour', statement_timestamp(), 'UTC');
    request_limit INTEGER := CASE p_operation WHEN 'advisor' THEN 30 WHEN 'steam_sync' THEN 10 END;
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

REVOKE EXECUTE ON FUNCTION public.claim_external_request(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_external_request(UUID, TEXT) TO service_role;
