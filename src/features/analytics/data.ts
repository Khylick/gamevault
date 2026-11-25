import "server-only";

import { z } from "zod";

import type { LibraryViewer } from "@/features/library/data";

const count = z.number().int().nonnegative();
const instant = z.iso.datetime({ offset: true });
const rankedGame = z.object({ id: z.uuid(), title: z.string(), minutesPlayed: count });
const datedActivity = rankedGame.extend({
  genre: z.string(),
  minutesPlayed: count.nullable(),
  lastPlayedOn: instant,
  artwork: z.object({ platform: z.string(), external_id: z.string(), cover_url: z.string().nullable() }),
});

const summarySchema = z.object({
  gameCount: count,
  knownPlaytimeCount: count,
  counts: z.object({ backlog: count, playing: count, completed: count }),
  minutesPlayed: count.nullable(),
  recentlyPlayed: datedActivity.array(),
  recentActivity: datedActivity.extend({ recentMinutes: count.positive(), lastPlayedOn: instant.nullable() }).array().optional(),
  mostPlayed: rankedGame.array(),
  otherMinutes: count,
});

const datedGame = z.object({ id: z.uuid(), title: z.string(), date: instant });

const detailsSchema = z.object({
  genreMinutes: z.object({ label: z.string(), minutes: count }).array(),
  taggedMinutes: count,
  backlogCounts: z.record(z.string(), count),
  recentAdditions: datedGame.array(),
  inactiveGames: datedGame.array(),
});

const historySchema = z.object({
  period_start: z.iso.date(),
  minutes: count.nullable(),
  intervals: count,
  unallocated_minutes: count,
  corrections: count,
}).array();

const reportSchema = z.object({ summary: summarySchema, details: detailsSchema, history: historySchema });

export type AnalyticsReport = z.infer<typeof reportSchema>;
export type AnalyticsPeriod = "week" | "month";

export async function readDashboard({ db }: LibraryViewer) {
  const { data, error } = await db.rpc("dashboard_summary");
  if (error) throw new Error("Impossible de lire le tableau de bord.");
  return summarySchema.parse(data);
}

export async function readAnalytics({ db }: LibraryViewer, period: AnalyticsPeriod) {
  const { data, error } = await db.rpc("analytics_report", { p_period: period });
  if (error) throw new Error("Impossible de lire les statistiques.");
  return reportSchema.parse(data);
}
