import { z } from "zod";

export const REPORT_CATEGORIES = [
  "harassment",
  "unsafe_conduct",
  "spam",
  "fraud",
  "privacy",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_RESOLUTIONS = ["dismiss", "resolve"] as const;

export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];

export const submitUserReportInputSchema = z
  .object({
    category: z.enum(REPORT_CATEGORIES),
    note: z.string().trim().max(2000).optional(),
    reportedUserId: z.string().uuid().optional(),
    matchId: z.string().uuid().optional(),
    messageId: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      Boolean(value.reportedUserId ?? value.matchId ?? value.messageId),
    { message: "Report target is required" },
  );

export type SubmitUserReportInput = z.infer<typeof submitUserReportInputSchema>;

export const resolveUserReportInputSchema = z.object({
  reportId: z.string().uuid(),
  resolution: z.enum(REPORT_RESOLUTIONS),
  reason: z.string().trim().min(3).max(500),
});

export type ResolveUserReportInput = z.infer<
  typeof resolveUserReportInputSchema
>;
