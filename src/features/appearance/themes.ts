import { z } from "zod";

export const themeSchema = z.enum(["midnight", "ocean", "light"]);

export type Theme = z.infer<typeof themeSchema>;

export const defaultTheme: Theme = "midnight";

export const themeLabels = {
  midnight: "Minuit",
  ocean: "Océan",
  light: "Clair",
} satisfies Record<Theme, string>;
