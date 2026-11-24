CREATE VIEW public.library_entries WITH (security_invoker = TRUE) AS
SELECT owned.user_id, owned.game_id, game.name, game.platform, game.external_id,
    game.description, game.cover_url, game.genres,
    owned.favorite, owned.playtime_minutes, owned.recent_playtime_minutes,
    owned.last_played_at, owned.created_at,
    backlog.status, backlog.priority, backlog.goals, backlog.started_on, backlog.finished_on,
    review.rating, review.comment
FROM public.user_games AS owned
INNER JOIN public.games AS game ON game.id = owned.game_id
LEFT JOIN public.backlog_items AS backlog USING (user_id, game_id)
LEFT JOIN public.user_reviews AS review USING (user_id, game_id);

CREATE VIEW public.library_genres WITH (security_invoker = TRUE) AS
SELECT DISTINCT entry.user_id, genre.name AS genre
FROM public.library_entries AS entry
CROSS JOIN LATERAL unnest(entry.genres) AS genre (name)
WHERE btrim(genre.name) <> '';

CREATE VIEW public.collection_library_entries WITH (security_invoker = TRUE) AS
SELECT member.collection_id, entry.*
FROM public.collection_games AS member
INNER JOIN public.library_entries AS entry USING (user_id, game_id);

REVOKE ALL ON public.library_entries, public.library_genres, public.collection_library_entries
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.library_entries, public.library_genres, public.collection_library_entries TO authenticated;

-- Les clés de propriété restent immuables. Chaque upsert écrit les champs de son formulaire.
CREATE FUNCTION public.set_library_status(p_game_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO public.backlog_items (user_id, game_id, status)
    VALUES ((SELECT auth.uid()), p_game_id, p_status)
    ON CONFLICT (user_id, game_id) DO UPDATE SET status = EXCLUDED.status;
$$;

CREATE FUNCTION public.save_library_progress(
    p_game_id UUID, p_status TEXT, p_priority SMALLINT, p_goals TEXT, p_started_on DATE, p_finished_on DATE
)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO public.backlog_items (user_id, game_id, status, priority, goals, started_on, finished_on)
    VALUES ((SELECT auth.uid()), p_game_id, p_status, p_priority, p_goals, p_started_on, p_finished_on)
    ON CONFLICT (user_id, game_id) DO UPDATE
    SET status = EXCLUDED.status, priority = EXCLUDED.priority, goals = EXCLUDED.goals,
        started_on = EXCLUDED.started_on, finished_on = EXCLUDED.finished_on;
$$;

CREATE FUNCTION public.save_library_review(p_game_id UUID, p_rating SMALLINT, p_comment TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO public.user_reviews (user_id, game_id, rating, comment)
    VALUES ((SELECT auth.uid()), p_game_id, p_rating, p_comment)
    ON CONFLICT (user_id, game_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment;
$$;

REVOKE EXECUTE ON FUNCTION
    public.set_library_status(UUID, TEXT),
    public.save_library_progress(UUID, TEXT, SMALLINT, TEXT, DATE, DATE),
    public.save_library_review(UUID, SMALLINT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
    public.set_library_status(UUID, TEXT),
    public.save_library_progress(UUID, TEXT, SMALLINT, TEXT, DATE, DATE),
    public.save_library_review(UUID, SMALLINT, TEXT)
TO authenticated;
