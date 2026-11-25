CREATE OR REPLACE FUNCTION public.dashboard_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH entries AS MATERIALIZED (
        SELECT game_id, name, platform, external_id, cover_url, genres, playtime_minutes, recent_playtime_minutes, last_played_at, status
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
    ), recent_activity AS (
        SELECT *
        FROM entries
        WHERE recent_playtime_minutes > 0
        ORDER BY last_played_at DESC NULLS LAST, recent_playtime_minutes DESC, game_id
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
        'recentActivity', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', game_id, 'title', name, 'genre', COALESCE(array_to_string(genres, ' · '), ''),
                'minutesPlayed', playtime_minutes, 'recentMinutes', recent_playtime_minutes, 'lastPlayedOn', last_played_at,
                'artwork', jsonb_build_object('platform', platform, 'external_id', external_id, 'cover_url', cover_url)
            ) ORDER BY last_played_at DESC NULLS LAST, recent_playtime_minutes DESC, game_id) FROM recent_activity
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
