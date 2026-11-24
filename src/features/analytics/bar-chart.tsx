"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { formatCount, formatPlaytime } from "@/features/dashboard/library-summary";

export type ChartPoint = { label: string; value: number | null };

export function AnalyticsBarChart({ points, name, layout = "horizontal", unit = "minutes" }: {
  points: ChartPoint[];
  name: string;
  layout?: "horizontal" | "vertical";
  unit?: "minutes" | "games";
}) {
  const valueText = unit === "minutes" ? formatPlaytime : formatCount;
  const horizontal = layout === "horizontal";
  const color = "var(--muted-foreground)";
  const gameTicks = unit === "games"
    ? Math.min(5, Math.max(1, ...points.map(({ value }) => value ?? 0)) + 1)
    : undefined;

  return (
    <div className="min-w-0">
      <BarChart data={points} layout={layout} responsive accessibilityLayer
        style={{ width: "100%", height: horizontal ? 245 : Math.max(140, points.length * 33 + 40) }}
        margin={{ top: 10, right: 10, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={!horizontal} horizontal={horizontal} stroke="var(--border)" strokeDasharray="3 5" />
        {horizontal ? (
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={{ fill: color, fontSize: 11 }} />
        ) : (
          <XAxis type="number" allowDecimals={false} tickCount={gameTicks} tickFormatter={valueText} tick={{ fill: color, fontSize: 11 }} />
        )}
        {horizontal ? (
          <YAxis allowDecimals={false} width={65} tickFormatter={valueText} tick={{ fill: color, fontSize: 11 }} />
        ) : (
          <YAxis type="category" dataKey="label" width={102} tickLine={false} axisLine={false}
            tickFormatter={(label: string) => label.length > 15 ? label.slice(0, 14) + "…" : label}
            tick={{ fill: color, fontSize: 11 }} />
        )}
        <Tooltip
          cursor={{ fill: "var(--secondary)" }}
          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: 12, color: "var(--foreground)" }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => typeof value === "number" ? valueText(value) : "Indisponible"}
        />
        <Bar dataKey="value" name={name} fill="var(--primary)" radius={horizontal ? [5, 5, 0, 0] : [0, 5, 5, 0]}
          maxBarSize={44} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}
