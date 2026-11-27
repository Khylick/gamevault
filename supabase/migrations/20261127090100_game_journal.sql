CREATE TABLE public.game_journal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    game_id UUID NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 2000 AND content ~ '[^[:space:]]'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id, game_id) REFERENCES public.user_games (user_id, game_id) ON DELETE CASCADE
);

CREATE INDEX game_journal_notes_recent_idx
ON public.game_journal_notes (user_id, game_id, created_at DESC, id DESC);

ALTER TABLE public.game_journal_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_journal_notes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.game_journal_notes TO authenticated;
GRANT INSERT (user_id, game_id, content), UPDATE (content)
ON TABLE public.game_journal_notes TO authenticated;

CREATE POLICY game_journal_notes_read_own ON public.game_journal_notes
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY game_journal_notes_insert_own ON public.game_journal_notes
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY game_journal_notes_update_own ON public.game_journal_notes
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY game_journal_notes_delete_own ON public.game_journal_notes
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
