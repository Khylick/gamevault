CREATE SCHEMA gamevault_private;
REVOKE ALL ON SCHEMA gamevault_private FROM PUBLIC;

CREATE FUNCTION gamevault_private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION gamevault_private.set_updated_at() FROM PUBLIC;

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name TEXT CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.steam_accounts (
    user_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
    -- Le format texte préserve SteamID64 lors de sa lecture en JavaScript.
    steam_id TEXT NOT NULL UNIQUE CHECK (
        steam_id ~ '^[1-9][0-9]{0,19}$'
        AND (char_length(steam_id) < 20 OR steam_id COLLATE "C" <= '18446744073709551615')
    ),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform ~ '^[a-z][a-z0-9_-]*$'),
    external_id TEXT NOT NULL CHECK (btrim(external_id) <> ''),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    description TEXT,
    cover_url TEXT,
    genres TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform, external_id)
);

CREATE TABLE public.user_games (
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games (id),
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    -- NULL indique une mesure indisponible. Zéro indique une valeur connue.
    playtime_minutes INTEGER CHECK (playtime_minutes >= 0),
    recent_playtime_minutes INTEGER CHECK (recent_playtime_minutes >= 0),
    last_played_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id),
    CHECK (recent_playtime_minutes <= playtime_minutes)
);

CREATE INDEX user_games_game_id_idx ON public.user_games (game_id);

CREATE TABLE public.game_playtime (
    user_id UUID NOT NULL,
    game_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    captured_on DATE GENERATED ALWAYS AS ((captured_at AT TIME ZONE 'UTC')::DATE) STORED,
    playtime_minutes INTEGER NOT NULL CHECK (playtime_minutes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Une observation cumulative par jeu et par jour UTC.
    PRIMARY KEY (user_id, game_id, captured_on),
    FOREIGN KEY (user_id, game_id) REFERENCES public.user_games (user_id, game_id) ON DELETE CASCADE
);

CREATE TABLE public.backlog_items (
    user_id UUID NOT NULL,
    game_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'to_start' CHECK (
        status IN ('to_discover', 'to_start', 'playing', 'paused', 'completed', 'abandoned')
    ),
    priority SMALLINT CHECK (priority BETWEEN 1 AND 5),
    goals TEXT,
    started_on DATE,
    finished_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id),
    FOREIGN KEY (user_id, game_id) REFERENCES public.user_games (user_id, game_id) ON DELETE CASCADE,
    CHECK (finished_on >= started_on)
);

CREATE TABLE public.collections (
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, id),
    UNIQUE (user_id, name)
);

CREATE TABLE public.collection_games (
    user_id UUID NOT NULL,
    collection_id UUID NOT NULL,
    game_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, collection_id, game_id),
    FOREIGN KEY (user_id, collection_id) REFERENCES public.collections (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, game_id) REFERENCES public.user_games (user_id, game_id) ON DELETE CASCADE
);

CREATE INDEX collection_games_user_game_idx ON public.collection_games (user_id, game_id);

CREATE TABLE public.user_reviews (
    user_id UUID NOT NULL,
    game_id UUID NOT NULL,
    rating SMALLINT CHECK (rating BETWEEN 1 AND 10),
    comment TEXT CHECK (btrim(comment) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id),
    FOREIGN KEY (user_id, game_id) REFERENCES public.user_games (user_id, game_id) ON DELETE CASCADE,
    CHECK (rating IS NOT NULL OR comment IS NOT NULL)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.steam_accounts
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.games
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_games
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.game_playtime
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.backlog_items
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_reviews
FOR EACH ROW EXECUTE FUNCTION gamevault_private.set_updated_at();

-- Les tables sont protégées dès leur création, avant l’attribution des droits.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_playtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.users,
    public.steam_accounts,
    public.games,
    public.user_games,
    public.game_playtime,
    public.backlog_items,
    public.collections,
    public.collection_games,
    public.user_reviews
FROM PUBLIC, anon, authenticated, service_role;
