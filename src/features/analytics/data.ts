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
const year = z.number().int().min(1900).max(2100);
const annualReportSchema = z.object({
  year,
  availableYears: year.array(),
  firstObservedOn: z.iso.date().nullable(),
  firstSampleOn: z.iso.date().nullable(),
  lastSampleOn: z.iso.date().nullable(),
  minutes: count.nullable(),
  corrections: count,
  mostPlayed: rankedGame.array(),
  completed: datedGame.extend({ date: z.iso.date() }).array(),
  bestRated: datedGame.pick({ id: true, title: true }).extend({ rating: z.number().int().min(1).max(10), position: count.positive() }).array(),
});

export type AnalyticsReport = z.infer<typeof reportSchema>;
export type AnnualLibraryReport = z.infer<typeof annualReportSchema>;
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

export async function readAnnualLibraryReport({ db }: LibraryViewer, selectedYear: number | null) {
  const { data, error } = await db.rpc("annual_library_report", { p_year: selectedYear });
  if (error) throw new Error("Impossible de lire le bilan annuel.");
  return annualReportSchema.parse(data);
}
