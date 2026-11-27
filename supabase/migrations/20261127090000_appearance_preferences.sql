CREATE TABLE public.appearance_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    theme TEXT NOT NULL CHECK (theme IN ('midnight', 'ocean', 'light'))
);

ALTER TABLE public.appearance_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appearance_preferences FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.appearance_preferences TO authenticated;

CREATE POLICY appearance_preferences_read_own ON public.appearance_preferences
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY appearance_preferences_insert_own ON public.appearance_preferences
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY appearance_preferences_update_own ON public.appearance_preferences
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
