CREATE TABLE public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    question TEXT NOT NULL CHECK (char_length(btrim(question)) BETWEEN 2 AND 500),
    answer JSONB NOT NULL CHECK (jsonb_typeof(answer) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_conversations_user_created_idx ON public.ai_conversations (user_id, created_at DESC, id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_conversations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.ai_conversations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_conversations TO service_role;

CREATE POLICY ai_conversations_read_own ON public.ai_conversations
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY ai_conversations_delete_own ON public.ai_conversations
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.advisor_library_matches(p_intent TEXT, p_minutes INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH entries AS MATERIALIZED (
        SELECT game_id, name, genres, favorite, status, rating, playtime_minutes, last_played_at
        FROM public.library_entries
        WHERE user_id = (SELECT auth.uid())
    ), favorite_genres AS MATERIALIZED (
        SELECT DISTINCT lower(btrim(tag)) AS normalized
        FROM entries AS game
        CROSS JOIN LATERAL unnest(game.genres) AS tags (tag)
        WHERE game.favorite AND btrim(tag) <> ''
    ), equipped AS (
        SELECT game.*,
            CASE
                WHEN p_intent IN ('relaxing', 'similar') THEN ARRAY(
                    SELECT DISTINCT btrim(tag)
                    FROM unnest(game.genres) AS tags (tag)
                    WHERE CASE p_intent
                        WHEN 'relaxing' THEN lower(btrim(tag)) IN (
                            'casual', 'cozy', 'relaxing', 'puzzle', 'simulation', 'détente', 'réflexion'
                        )
                        ELSE lower(btrim(tag)) IN (SELECT normalized FROM favorite_genres)
                    END
                    ORDER BY btrim(tag)
                )
                ELSE ARRAY[]::TEXT[]
            END AS matched_genres
        FROM entries AS game
    ), eligible AS MATERIALIZED (
        SELECT *
        FROM equipped
        WHERE CASE p_intent
            WHEN 'unplayed' THEN playtime_minutes = 0 AND last_played_at IS NULL
            WHEN 'abandoned' THEN status = 'abandoned' AND (p_minutes IS NULL OR playtime_minutes < p_minutes)
            WHEN 'relaxing' THEN cardinality(matched_genres) > 0 AND status IS DISTINCT FROM 'abandoned'
            WHEN 'similar' THEN NOT favorite AND cardinality(matched_genres) > 0 AND status IS DISTINCT FROM 'abandoned'
            WHEN 'session' THEN status IS DISTINCT FROM 'abandoned'
            ELSE FALSE
        END
    ), ranked AS (
        SELECT *, row_number() OVER (
            ORDER BY cardinality(matched_genres) DESC,
                (p_intent IN ('session', 'relaxing') AND favorite) DESC,
                (p_intent IN ('session', 'relaxing') AND status = 'playing') DESC NULLS LAST,
                CASE WHEN p_intent IN ('session', 'similar', 'relaxing') THEN rating END DESC NULLS LAST,
                name, game_id
        ) AS rank
        FROM eligible
    )
    SELECT jsonb_build_object(
        'total', (SELECT count(*) FROM eligible),
        'games', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', game_id, 'title', name, 'minutesPlayed', playtime_minutes,
            'favorite', favorite, 'status', status, 'matchedGenres', matched_genres
        ) ORDER BY rank) FROM ranked WHERE rank <= 6), '[]'::JSONB)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.advisor_library_matches(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advisor_library_matches(TEXT, INTEGER) TO authenticated;
