CREATE TABLE public.dashboard_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    block_order TEXT[] NOT NULL,
    hidden_blocks TEXT[] NOT NULL,
    CHECK (
        array_ndims(block_order) = 1
        AND cardinality(block_order) = 4
        AND block_order @> ARRAY['hero', 'metrics', 'recent', 'top']
    ),
    CHECK (
        COALESCE(array_ndims(hidden_blocks), 1) = 1
        AND cardinality(hidden_blocks) <= 4
        AND hidden_blocks <@ ARRAY['hero', 'metrics', 'recent', 'top']
    )
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dashboard_preferences FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE, UPDATE
ON TABLE public.dashboard_preferences TO authenticated;

CREATE POLICY dashboard_preferences_read_own ON public.dashboard_preferences
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY dashboard_preferences_insert_own ON public.dashboard_preferences
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY dashboard_preferences_update_own ON public.dashboard_preferences
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY dashboard_preferences_delete_own ON public.dashboard_preferences
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
