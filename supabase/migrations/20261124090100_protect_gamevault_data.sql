GRANT SELECT ON TABLE
    public.users,
    public.steam_accounts,
    public.games,
    public.user_games,
    public.game_playtime,
    public.backlog_items,
    public.collections,
    public.collection_games,
    public.user_reviews
TO authenticated;

GRANT INSERT (id, display_name), UPDATE (display_name)
ON TABLE public.users TO authenticated;

GRANT UPDATE (favorite) ON TABLE public.user_games TO authenticated;

GRANT INSERT (user_id, game_id, status, priority, goals, started_on, finished_on),
    UPDATE (status, priority, goals, started_on, finished_on), DELETE
ON TABLE public.backlog_items TO authenticated;

GRANT INSERT (user_id, id, name, description), UPDATE (name, description), DELETE
ON TABLE public.collections TO authenticated;

GRANT INSERT (user_id, collection_id, game_id), DELETE
ON TABLE public.collection_games TO authenticated;

GRANT INSERT (user_id, game_id, rating, comment), UPDATE (rating, comment), DELETE
ON TABLE public.user_reviews TO authenticated;

-- La synchronisation Steam utilisera ce rôle exclusivement côté serveur.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.users,
    public.steam_accounts,
    public.games,
    public.user_games,
    public.game_playtime,
    public.backlog_items,
    public.collections,
    public.collection_games,
    public.user_reviews
TO service_role;

CREATE POLICY users_read_own ON public.users
FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

CREATE POLICY users_insert_own ON public.users
FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY users_update_own ON public.users
FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY steam_accounts_read_own ON public.steam_accounts
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY games_read_catalog ON public.games
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY user_games_read_own ON public.user_games
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_games_update_own ON public.user_games
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY game_playtime_read_own ON public.game_playtime
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY backlog_items_manage_own ON public.backlog_items
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY collections_manage_own ON public.collections
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY collection_games_manage_own ON public.collection_games
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_reviews_manage_own ON public.user_reviews
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
