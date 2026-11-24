export type DashboardGame = {
  id: string;
  title: string;
  genre?: string;
  minutesPlayed: number | null;
  lastPlayedOn?: string;
  cover?: string;
  artwork?: { platform: string; external_id: string; cover_url: string | null };
};

export type LibraryGame = DashboardGame & {
  status: "backlog" | "playing" | "completed";
  minutesPlayed: number;
};

type RecentlyPlayedGame = DashboardGame & { lastPlayedOn: string };

export type LibrarySummary = {
  gameCount: number;
  knownPlaytimeCount: number;
  counts: { backlog: number; playing: number; completed: number };
  minutesPlayed: number | null;
  recentlyPlayed: RecentlyPlayedGame[];
  mostPlayed: (DashboardGame & { minutesPlayed: number })[];
  otherMinutes: number;
};

export function summarizeLibrary(games: readonly LibraryGame[]): LibrarySummary {
  const counts = { backlog: 0, playing: 0, completed: 0 };
  let minutesPlayed = 0;

  for (const game of games) {
    counts[game.status] += 1;
    minutesPlayed += game.minutesPlayed;
  }

  const recentlyPlayed = games
    .filter((game): game is LibraryGame & { lastPlayedOn: string } => game.lastPlayedOn !== undefined)
    .sort((first, second) => second.lastPlayedOn.localeCompare(first.lastPlayedOn))
    .slice(0, 3);

  const mostPlayed = games
    .filter((game) => game.minutesPlayed > 0)
    .sort((first, second) => second.minutesPlayed - first.minutesPlayed)
    .slice(0, 5);

  const otherMinutes = minutesPlayed - mostPlayed.reduce((sum, game) => sum + game.minutesPlayed, 0);

  return { gameCount: games.length, knownPlaytimeCount: games.length, counts, minutesPlayed, recentlyPlayed, mostPlayed, otherMinutes };
}

export const formatCount = new Intl.NumberFormat("fr-FR").format;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatPlayDate(day: string) {
  return dateFormatter.format(new Date(day));
}

export function formatPlaytime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return formatCount(rest) + "\u00a0min";
  if (rest === 0) return formatCount(hours) + "\u00a0h";

  return formatCount(hours) + "\u00a0h " + String(rest).padStart(2, "0");
}
