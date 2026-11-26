CREATE FUNCTION public.annual_library_report(p_year INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH current_year AS (
        SELECT extract(YEAR FROM statement_timestamp() AT TIME ZONE 'UTC')::INTEGER AS year
    ), selection AS (
        SELECT year AS current_year, CASE WHEN p_year BETWEEN 1900 AND 2100 THEN p_year ELSE year END AS year
        FROM current_year
    ), bounds AS (
        SELECT *, make_date(year, 1, 1) AS first_day, make_date(year + 1, 1, 1) AS next_year
        FROM selection
    ), recorded_years AS MATERIALIZED (
        SELECT extract(YEAR FROM captured_on)::INTEGER AS year, min(captured_on) AS first_on
        FROM public.game_playtime
        WHERE user_id = (SELECT auth.uid())
        GROUP BY 1
    ), completed_entries AS MATERIALIZED (
        SELECT item.game_id, item.finished_on
        FROM public.backlog_items AS item
        WHERE item.user_id = (SELECT auth.uid()) AND item.status = 'completed' AND item.finished_on IS NOT NULL
    ), available_years AS (
        SELECT year FROM recorded_years WHERE year BETWEEN 1900 AND 2100
        UNION SELECT extract(YEAR FROM finished_on)::INTEGER FROM completed_entries
            WHERE finished_on >= DATE '1900-01-01' AND finished_on < DATE '2101-01-01'
        UNION SELECT ranking_year FROM public.personal_game_rankings WHERE ranking_year IS NOT NULL
        UNION SELECT current_year FROM bounds
        UNION SELECT year FROM bounds
    ), snapshots AS MATERIALIZED (
        SELECT snapshot.game_id, snapshot.captured_on, snapshot.playtime_minutes
        FROM public.game_playtime AS snapshot
        CROSS JOIN bounds
        WHERE snapshot.user_id = (SELECT auth.uid())
            AND snapshot.captured_on >= first_day AND snapshot.captured_on < next_year
    ), deltas AS (
        SELECT game_id, playtime_minutes - lag(playtime_minutes) OVER (PARTITION BY game_id ORDER BY captured_on) AS minutes
        FROM snapshots
    ), per_game AS MATERIALIZED (
        SELECT game_id, sum(minutes) FILTER (WHERE minutes >= 0) AS minutes,
            count(*) FILTER (WHERE minutes < 0) AS corrections
        FROM deltas GROUP BY game_id
    ), top_played AS (
        SELECT measured.game_id, game.name, measured.minutes
        FROM per_game AS measured JOIN public.games AS game ON game.id = measured.game_id
        WHERE measured.minutes > 0
        ORDER BY measured.minutes DESC, game.name, measured.game_id
        LIMIT 5
    ), completed AS (
        SELECT entry.game_id, game.name, entry.finished_on
        FROM completed_entries AS entry
        JOIN public.games AS game ON game.id = entry.game_id
        CROSS JOIN bounds
        WHERE entry.finished_on >= first_day AND entry.finished_on < next_year
    ), best_rated AS (
        SELECT game_id, name, rating, ranking_position
        FROM public.personal_game_rankings
        CROSS JOIN bounds
        WHERE ranking_year = year
        ORDER BY ranking_position, name, game_id
        LIMIT 5
    )
    SELECT jsonb_build_object(
        'year', bounds.year,
        'availableYears', (SELECT jsonb_agg(year ORDER BY year DESC) FROM available_years),
        'firstObservedOn', (SELECT min(first_on) FROM recorded_years),
        'firstSampleOn', (SELECT min(captured_on) FROM snapshots),
        'lastSampleOn', (SELECT max(captured_on) FROM snapshots),
        'minutes', (SELECT sum(minutes) FROM per_game),
        'corrections', (SELECT COALESCE(sum(corrections), 0) FROM per_game),
        'mostPlayed', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', game_id, 'title', name, 'minutesPlayed', minutes)
                ORDER BY minutes DESC, name, game_id)
            FROM top_played
        ), '[]'::JSONB),
        'completed', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', game_id, 'title', name, 'date', finished_on)
                ORDER BY finished_on DESC, name, game_id)
            FROM completed
        ), '[]'::JSONB),
        'bestRated', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', game_id, 'title', name, 'rating', rating, 'position', ranking_position)
                ORDER BY ranking_position, name, game_id)
            FROM best_rated
        ), '[]'::JSONB)
    )
    FROM bounds;
$$;

REVOKE EXECUTE ON FUNCTION public.annual_library_report(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.annual_library_report(INTEGER) TO authenticated;
