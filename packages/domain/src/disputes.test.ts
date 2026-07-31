import { describe, expect, it } from "vitest";
import { formatDisputeScore, resolveDisputeInputSchema } from "./disputes";

describe("disputes", () => {
  it("validates resolve dispute input", () => {
    expect(
      resolveDisputeInputSchema.safeParse({
        resultId: "11111111-1111-4111-8111-111111111111",
        resolution: "confirm",
        reason: "Both players agreed offline",
      }).success,
    ).toBe(true);
    expect(
      resolveDisputeInputSchema.safeParse({
        resultId: "11111111-1111-4111-8111-111111111111",
        resolution: "void",
        reason: "no",
      }).success,
    ).toBe(false);
  });

  it("formats dispute scores", () => {
    expect(
      formatDisputeScore({
        sets: [
          [6, 4],
          [7, 6],
        ],
      }),
    ).toBe("6-4, 7-6");
  });
});
