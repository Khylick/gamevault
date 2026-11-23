import { CircleCheck, Clock3, Gamepad2, Layers3, ListTodo } from "lucide-react";

import { Card } from "@/components/ui/card";

import { formatCount, formatPlaytime, type LibrarySummary } from "./library-summary";

export function DashboardMetrics({ summary }: { summary: LibrarySummary }) {
  const metrics = [
    { label: "Jeux possédés", value: formatCount(summary.gameCount), icon: Layers3, color: "bg-primary/10 text-primary" },
    { label: "Temps de jeu", value: formatPlaytime(summary.minutesPlayed), icon: Clock3, color: "bg-sky-400/10 text-sky-300" },
    { label: "Terminés", value: formatCount(summary.counts.completed), icon: CircleCheck, color: "bg-emerald-400/10 text-emerald-300" },
    { label: "En cours", value: formatCount(summary.counts.playing), icon: Gamepad2, color: "bg-amber-400/10 text-amber-300" },
    { label: "Dans le backlog", value: formatCount(summary.counts.backlog), icon: ListTodo, color: "bg-pink-400/10 text-pink-300" },
  ];

  return (
    <section aria-label="Aperçu de la bibliothèque">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex flex-col p-4 last:col-span-2 sm:p-5 xl:last:col-span-1">
            <dt className="text-sm font-medium leading-snug text-muted-foreground">
              <span className={"mb-3 grid size-9 place-items-center rounded-lg " + color}>
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              {label}
            </dt>
            <dd className="mt-1 text-xl font-semibold tracking-[-0.045em] tabular-nums sm:text-2xl lg:text-[1.75rem]">{value}</dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}
