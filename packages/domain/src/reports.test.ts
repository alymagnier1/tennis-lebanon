import { describe, expect, it } from "vitest";
import {
  REPORT_CATEGORIES,
  resolveUserReportInputSchema,
  submitUserReportInputSchema,
} from "./reports";

describe("reports", () => {
  it("validates submit report input", () => {
    expect(
      submitUserReportInputSchema.safeParse({
        category: REPORT_CATEGORIES[0],
        reportedUserId: "11111111-1111-4111-8111-111111111111",
        note: "Repeated harassment in chat",
      }).success,
    ).toBe(true);
    expect(
      submitUserReportInputSchema.safeParse({
        category: REPORT_CATEGORIES[0],
        note: "Missing target",
      }).success,
    ).toBe(false);
  });

  it("validates resolve report input", () => {
    expect(
      resolveUserReportInputSchema.safeParse({
        reportId: "11111111-1111-4111-8111-111111111111",
        resolution: "dismiss",
        reason: "No policy violation",
      }).success,
    ).toBe(true);
    expect(
      resolveUserReportInputSchema.safeParse({
        reportId: "11111111-1111-4111-8111-111111111111",
        resolution: "dismiss",
        reason: "no",
      }).success,
    ).toBe(false);
  });
});
