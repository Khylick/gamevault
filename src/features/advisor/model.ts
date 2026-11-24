import { z } from "zod";

export const advisorIntent = z.enum([
  "session", "relaxing", "unplayed", "abandoned", "completion", "similar", "unsupported",
]);
export type AdvisorIntent = z.infer<typeof advisorIntent>;

export const questionSchema = z.string().trim().min(2).max(500);
export const advisorToolName = "query_owned_library";
export const interpretationSchema = z.object({
  intent: advisorIntent,
  durationText: z.string().min(1).max(80).nullable(),
}).strict();
export type Interpretation = z.infer<typeof interpretationSchema>;

const number = z.number().int().nonnegative();
export const advisorMatchesSchema = z.object({
  total: number,
  games: z.object({
    id: z.uuid(),
    title: z.string(),
    minutesPlayed: number.nullable(),
    favorite: z.boolean(),
    status: z.string().nullable(),
    matchedGenres: z.string().array(),
  }).array().max(6),
});

export const answerSchema = z.object({
  intent: advisorIntent,
  durationMinutes: number.nullable(),
  matches: advisorMatchesSchema,
});
export type AdvisorAnswer = z.infer<typeof answerSchema>;

export const advisorExamples = [
  "J’ai 45 minutes devant moi, à quoi jouer ?",
  "Propose-moi un jeu relaxant.",
  "Quels jeux n’ai-je jamais lancés ?",
  "Quels jeux ai-je abandonnés après moins de 5 heures ?",
  "Quel jeu pourrais-je terminer en moins de 15 heures ?",
  "Propose-moi un jeu similaire à mes favoris.",
];

const minutesOnly = /^(\d{1,5})\s*(?:minutes?|min)$/iu;
const hoursAndMinutes = /^(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:heures?|h)(?:\s*([0-5]?\d)\s*(?:minutes?|min)?)?$/iu;
const durationInQuestion = /(?<![\p{L}\p{N}.,])(?:\d{1,3}(?:[.,]\d{1,2})?\s*(?:heures?|h)(?:\s*[0-5]?\d\s*(?:minutes?|min)?)?|\d{1,5}\s*(?:minutes?|min))(?![\p{L}\p{N}])/giu;

export function resolveDuration(question: string, interpretation: Interpretation) {
  if (!["session", "abandoned", "completion"].includes(interpretation.intent)) return null;

  const durations = [...question.matchAll(durationInQuestion)];
  if (durations.length > 1) return "ambiguous" as const;
  const duration = durations[0];
  if (!duration) return interpretation.durationText === null ? null : "ambiguous" as const;
  const beforeDuration = question.slice(0, duration.index);
  if (interpretation.intent === "abandoned" && !/(?:moins de|inférieur à|<)\s*$/iu.test(beforeDuration)) {
    return "ambiguous" as const;
  }

  const minutes = minutesOnly.exec(duration[0].trim());
  if (minutes) return Number(minutes[1]) || "ambiguous" as const;

  const hours = hoursAndMinutes.exec(duration[0].trim());
  if (!hours || (hours[2] && /[.,]/.test(hours[1]))) return "ambiguous" as const;
  return Math.round(Number(hours[1].replace(",", ".")) * 60) + Number(hours[2] ?? 0) || "ambiguous" as const;
}

const providerResponseSchema = z.object({
  status: z.literal("completed"),
  output: z.object({
    type: z.string(),
    role: z.string().optional(),
    name: z.string().optional(),
    arguments: z.string().optional(),
    content: z.object({ type: z.string() }).array().optional(),
  }).array(),
});

export function readInterpretation(value: unknown): Interpretation | null {
  const response = providerResponseSchema.safeParse(value);
  if (!response.success) return null;
  const messages = response.data.output
    .filter(({ type, role }) => type === "message" && role === "assistant")
    .flatMap(({ content }) => content ?? []);

  if (messages.some(({ type }) => type === "refusal")) return { intent: "unsupported", durationText: null };

  const calls = response.data.output.filter(({ type }) => type === "function_call");
  if (calls.length !== 1 || calls[0].name !== advisorToolName) return null;
  const args = calls[0].arguments;
  if (!args || args.length > 1024) return null;

  try {
    const interpretation = interpretationSchema.safeParse(JSON.parse(args));
    return interpretation.success ? interpretation.data : null;
  } catch {
    return null;
  }
}
