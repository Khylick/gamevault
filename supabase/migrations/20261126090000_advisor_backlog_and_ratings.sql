CREATE OR REPLACE FUNCTION public.advisor_library_matches(p_intent TEXT, p_minutes INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH entries AS MATERIALIZED (
        SELECT game_id, name, genres, favorite, status, rating, playtime_minutes, last_played_at
        FROM public.library_entries
        WHERE user_id = (SELECT auth.uid())
    ), best_rating AS (
        SELECT max(rating) AS score FROM entries WHERE p_intent = 'similar_rated'
    ), favorite_genres AS MATERIALIZED (
        SELECT DISTINCT lower(btrim(tag)) AS normalized
        FROM entries AS game
        CROSS JOIN LATERAL unnest(game.genres) AS tags (tag)
        WHERE p_intent = 'similar' AND game.favorite AND btrim(tag) <> ''
    ), preference_tags AS MATERIALIZED (
        SELECT DISTINCT game.game_id, game.name, game.rating, game.favorite, lower(btrim(tag)) AS normalized
        FROM entries AS game
        CROSS JOIN LATERAL unnest(game.genres) AS tags (tag)
        WHERE btrim(tag) <> '' AND CASE p_intent
            WHEN 'similar_rated' THEN game.rating = (SELECT score FROM best_rating)
            WHEN 'resume' THEN game.favorite OR game.rating >= 8
            ELSE FALSE
        END
    ), candidates AS (
        SELECT game.*,
            ARRAY(SELECT DISTINCT lower(btrim(tag)) FROM unnest(game.genres) AS tags (tag) WHERE btrim(tag) <> '') AS normalized_genres
        FROM entries AS game
        WHERE CASE p_intent
            WHEN 'unplayed' THEN playtime_minutes = 0 AND last_played_at IS NULL
            WHEN 'abandoned' THEN status = 'abandoned' AND (p_minutes IS NULL OR playtime_minutes < p_minutes)
            WHEN 'similar' THEN NOT favorite AND status IS DISTINCT FROM 'abandoned'
            WHEN 'similar_rated' THEN rating IS DISTINCT FROM (SELECT score FROM best_rating) AND status IS DISTINCT FROM 'abandoned'
            WHEN 'resume' THEN status IN ('playing', 'paused')
            WHEN 'session' THEN status IS DISTINCT FROM 'abandoned'
            WHEN 'relaxing' THEN status IS DISTINCT FROM 'abandoned'
            ELSE FALSE
        END
    ), equipped AS (
        SELECT game.*,
            CASE
                WHEN p_intent IN ('relaxing', 'similar', 'similar_rated', 'resume') THEN ARRAY(
                    SELECT btrim(min(tag))
                    FROM unnest(game.genres) AS tags (tag)
                    WHERE CASE p_intent
                        WHEN 'relaxing' THEN lower(btrim(tag)) IN (
                            'casual', 'cozy', 'relaxing', 'puzzle', 'simulation', 'détente', 'réflexion'
                        )
                        WHEN 'similar' THEN lower(btrim(tag)) IN (SELECT normalized FROM favorite_genres)
                        ELSE EXISTS (
                            SELECT 1 FROM preference_tags AS preference
                            WHERE preference.normalized = lower(btrim(tag)) AND preference.game_id <> game.game_id
                        )
                    END
                    GROUP BY lower(btrim(tag))
                    ORDER BY lower(btrim(tag))
                )
                ELSE ARRAY[]::TEXT[]
            END AS matched_genres
        FROM candidates AS game
    ), eligible AS MATERIALIZED (
        SELECT *
        FROM equipped
        WHERE p_intent NOT IN ('relaxing', 'similar', 'similar_rated') OR cardinality(matched_genres) > 0
    ), ranked AS (
        SELECT *, row_number() OVER (
            ORDER BY cardinality(matched_genres) DESC,
                (p_intent = 'resume' AND status = 'playing') DESC NULLS LAST,
                (p_intent IN ('session', 'relaxing', 'resume') AND favorite) DESC,
                (p_intent IN ('session', 'relaxing') AND status = 'playing') DESC NULLS LAST,
                CASE WHEN p_intent IN ('session', 'similar', 'relaxing', 'similar_rated', 'resume') THEN rating END DESC NULLS LAST,
                name, game_id
        ) AS rank
        FROM eligible
    )
    SELECT jsonb_build_object(
        'total', (SELECT count(*) FROM eligible),
        'games', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', game.game_id, 'title', game.name, 'minutesPlayed', game.playtime_minutes,
                'favorite', game.favorite, 'status', game.status, 'matchedGenres', game.matched_genres,
                'rating', game.rating,
                'favoriteGenreMatch', p_intent = 'resume' AND EXISTS (
                    SELECT 1 FROM preference_tags AS preference
                    WHERE preference.favorite AND preference.game_id <> game.game_id
                        AND preference.normalized = ANY(game.normalized_genres)
                ),
                'ratedReferences', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('title', reference.name, 'rating', reference.rating)
                        ORDER BY reference.rating DESC, reference.name, reference.game_id)
                    FROM (
                        SELECT preference.game_id, preference.name, preference.rating
                        FROM preference_tags AS preference
                        WHERE preference.game_id <> game.game_id AND preference.normalized = ANY(game.normalized_genres)
                            AND (p_intent = 'similar_rated' OR preference.rating >= 8)
                        GROUP BY preference.game_id, preference.name, preference.rating
                        ORDER BY preference.rating DESC, preference.name, preference.game_id
                        LIMIT 3
                    ) AS reference
                ), '[]'::JSONB)
            ) ORDER BY game.rank)
            FROM ranked AS game WHERE game.rank <= 6
        ), '[]'::JSONB)
    );
$$;
