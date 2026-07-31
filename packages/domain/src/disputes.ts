import { z } from "zod";

export const DISPUTE_RESOLUTIONS = ["confirm", "void"] as const;

export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

export const resolveDisputeInputSchema = z.object({
  resultId: z.string().uuid(),
  resolution: z.enum(DISPUTE_RESOLUTIONS),
  reason: z.string().trim().min(3).max(500),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeInputSchema>;

export function formatDisputeScore(score: {
  sets: [number, number][];
}): string {
  return score.sets.map(([a, b]) => `${a}-${b}`).join(", ");
}
