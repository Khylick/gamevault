CREATE INDEX game_playtime_user_day_idx ON public.game_playtime (user_id, captured_on);

CREATE FUNCTION public.dashboard_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH entries AS MATERIALIZED (
        SELECT game_id, name, platform, external_id, cover_url, genres, playtime_minutes, last_played_at, status
        FROM public.library_entries
        WHERE user_id = (SELECT auth.uid())
    ), totals AS (
        SELECT count(*) AS game_count, count(playtime_minutes) AS known_count, sum(playtime_minutes) AS minutes,
            count(*) FILTER (WHERE status = 'completed') AS completed,
            count(*) FILTER (WHERE status = 'playing') AS playing,
            count(*) FILTER (WHERE status IN ('to_discover', 'to_start', 'paused')) AS backlog
        FROM entries
    ), recent AS (
        SELECT *
        FROM entries
        WHERE last_played_at IS NOT NULL
        ORDER BY last_played_at DESC, game_id
        LIMIT 3
    ), top_played AS (
        SELECT game_id, name, playtime_minutes
        FROM entries
        WHERE playtime_minutes > 0
        ORDER BY playtime_minutes DESC, game_id
        LIMIT 5
    )
    SELECT jsonb_build_object(
        'gameCount', game_count,
        'knownPlaytimeCount', known_count,
        'minutesPlayed', minutes,
        'counts', jsonb_build_object('completed', completed, 'playing', playing, 'backlog', backlog),
        'recentlyPlayed', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', game_id, 'title', name, 'genre', COALESCE(array_to_string(genres, ' · '), ''),
                'minutesPlayed', playtime_minutes, 'lastPlayedOn', last_played_at,
                'artwork', jsonb_build_object('platform', platform, 'external_id', external_id, 'cover_url', cover_url)
            ) ORDER BY last_played_at DESC, game_id) FROM recent
        ), '[]'::JSONB),
        'mostPlayed', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', game_id, 'title', name, 'minutesPlayed', playtime_minutes)
                ORDER BY playtime_minutes DESC, game_id)
            FROM top_played
        ), '[]'::JSONB),
        'otherMinutes', COALESCE(minutes, 0) - COALESCE((SELECT sum(playtime_minutes) FROM top_played), 0)
    )
    FROM totals;
$$;

CREATE FUNCTION public.library_analytics()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH entries AS MATERIALIZED (
        SELECT game_id, name, genres, playtime_minutes, last_played_at, created_at, status
        FROM public.library_entries
        WHERE user_id = (SELECT auth.uid())
    ), tagged AS (
        SELECT entry.game_id, entry.playtime_minutes, genre.name
        FROM entries AS entry
        CROSS JOIN LATERAL (
            SELECT DISTINCT btrim(value) AS name
            FROM unnest(entry.genres) AS tags (value)
            WHERE btrim(value) <> ''
        ) AS genre
        WHERE entry.playtime_minutes > 0
    ), genre_totals AS (
        SELECT name, sum(playtime_minutes) AS minutes
        FROM tagged
        GROUP BY name
        ORDER BY minutes DESC, name
        LIMIT 10
    ), latest AS (
        SELECT game_id, name, created_at
        FROM entries
        ORDER BY created_at DESC, game_id
        LIMIT 5
    ), inactive AS (
        SELECT game_id, name, last_played_at
        FROM entries
        WHERE last_played_at < statement_timestamp() - INTERVAL '90 days'
        ORDER BY last_played_at, game_id
        LIMIT 5
    )
    SELECT jsonb_build_object(
        'genreMinutes', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', name, 'minutes', minutes) ORDER BY minutes DESC, name)
            FROM genre_totals), '[]'::JSONB),
        'taggedMinutes', COALESCE((SELECT sum(playtime_minutes)
            FROM (SELECT DISTINCT game_id, playtime_minutes FROM tagged) AS distinct_games), 0),
        'backlogCounts', COALESCE((
            SELECT jsonb_object_agg(status, total)
            FROM (SELECT status, count(*) AS total FROM entries WHERE status IS NOT NULL GROUP BY status) AS counts
        ), '{}'::JSONB),
        'recentAdditions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', game_id, 'title', name, 'date', created_at)
            ORDER BY created_at DESC, game_id) FROM latest), '[]'::JSONB),
        'inactiveGames', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', game_id, 'title', name, 'date', last_played_at)
            ORDER BY last_played_at, game_id) FROM inactive), '[]'::JSONB)
    );
$$;

CREATE FUNCTION public.playtime_history(
    p_period TEXT, p_reference_day DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE
)
RETURNS TABLE (
    period_start DATE, minutes BIGINT, intervals BIGINT, unallocated_minutes BIGINT, corrections BIGINT
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH bounds AS (
        SELECT date_trunc(p_period, p_reference_day::TIMESTAMP)::DATE AS last_period,
            CASE p_period WHEN 'week' THEN INTERVAL '1 week' ELSE INTERVAL '1 month' END AS step,
            CASE p_period WHEN 'week' THEN 7 ELSE 5 END AS steps_back
        WHERE p_period IN ('week', 'month')
    ), window_bounds AS (
        SELECT *, (last_period - steps_back * step)::DATE AS first_period
        FROM bounds
    ), in_window AS MATERIALIZED (
        SELECT snapshot.game_id, snapshot.captured_on, snapshot.playtime_minutes
        FROM public.game_playtime AS snapshot
        CROSS JOIN window_bounds
        WHERE snapshot.user_id = (SELECT auth.uid())
            AND snapshot.captured_on BETWEEN first_period AND p_reference_day
    ), prior AS (
        SELECT previous.game_id, previous.captured_on, previous.playtime_minutes
        FROM (SELECT DISTINCT game_id FROM in_window) AS active_games
        CROSS JOIN window_bounds
        CROSS JOIN LATERAL (
            SELECT snapshot.game_id, snapshot.captured_on, snapshot.playtime_minutes
            FROM public.game_playtime AS snapshot
            WHERE snapshot.user_id = (SELECT auth.uid())
                AND snapshot.game_id = active_games.game_id
                AND snapshot.captured_on < first_period
            ORDER BY snapshot.captured_on DESC
            LIMIT 1
        ) AS previous
    ), deltas AS (
        SELECT captured_on, date_trunc(p_period, captured_on::TIMESTAMP)::DATE AS bucket,
            date_trunc(p_period, (lag(captured_on) OVER per_game)::TIMESTAMP)::DATE AS previous_bucket,
            playtime_minutes - lag(playtime_minutes) OVER per_game AS delta
        FROM (SELECT * FROM in_window UNION ALL SELECT * FROM prior) AS snapshots
        WINDOW per_game AS (PARTITION BY game_id ORDER BY captured_on)
    ), aggregated AS (
        SELECT bucket, sum(delta) FILTER (WHERE bucket = previous_bucket AND delta >= 0) AS minutes,
            count(*) FILTER (WHERE bucket = previous_bucket AND delta >= 0) AS intervals,
            sum(delta) FILTER (WHERE bucket <> previous_bucket AND delta > 0) AS unallocated_minutes,
            count(*) FILTER (WHERE delta < 0) AS corrections
        FROM deltas
        CROSS JOIN window_bounds
        WHERE captured_on >= first_period
        GROUP BY bucket
    )
    SELECT period::DATE, aggregated.minutes, COALESCE(aggregated.intervals, 0),
        COALESCE(aggregated.unallocated_minutes, 0), COALESCE(aggregated.corrections, 0)
    FROM window_bounds
    CROSS JOIN LATERAL generate_series(first_period::TIMESTAMP, last_period::TIMESTAMP, step) AS periods (period)
    LEFT JOIN aggregated ON aggregated.bucket = periods.period::DATE
    ORDER BY periods.period;
$$;

CREATE FUNCTION public.analytics_report(p_period TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'summary', public.dashboard_summary(),
        'details', public.library_analytics(),
        'history', COALESCE(jsonb_agg(to_jsonb(history) ORDER BY period_start), '[]'::JSONB)
    )
    FROM public.playtime_history(p_period) AS history;
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_summary(), public.library_analytics(), public.playtime_history(TEXT, DATE), public.analytics_report(TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary(), public.library_analytics(), public.playtime_history(TEXT, DATE), public.analytics_report(TEXT)
TO authenticated;
