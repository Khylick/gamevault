import { z } from "zod";

const blocks = ["hero", "metrics", "recent", "top"] as const;
const dashboardBlock = z.enum(blocks);

export type DashboardBlock = z.infer<typeof dashboardBlock>;

export const blockLabels: Record<DashboardBlock, string> = {
  hero: "Mise en avant Steam",
  metrics: "Indicateurs de la bibliothèque",
  recent: "Activité Steam récente",
  top: "Top 5 des jeux les plus joués",
};

export const dashboardLayoutSchema = z.object({
  block_order: z.array(dashboardBlock).length(blocks.length).refine((order) => new Set(order).size === blocks.length),
  hidden_blocks: z.array(dashboardBlock).max(blocks.length).transform((hidden) => [...new Set(hidden)]),
});

export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

export const defaultDashboardLayout: DashboardLayout = { block_order: [...blocks], hidden_blocks: [] };

export function isDefaultDashboardLayout(layout: DashboardLayout) {
  return layout.hidden_blocks.length === 0 && blocks.every((block, index) => layout.block_order[index] === block);
}
