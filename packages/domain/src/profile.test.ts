import { describe, expect, it } from "vitest";
import { updatePreferredZonesSchema } from "./profile";

describe("updatePreferredZonesSchema", () => {
  it("accepts one or more unique zone ids", () => {
    const result = updatePreferredZonesSchema.safeParse({
      zoneIds: [
        "aaaaaaaa-0001-0001-0001-000000000001",
        "aaaaaaaa-0001-0001-0001-000000000002",
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty selection", () => {
    const result = updatePreferredZonesSchema.safeParse({
      zoneIds: [],
    });

    expect(result.success).toBe(false);
  });

  it("deduplicates zone ids", () => {
    const zoneId = "aaaaaaaa-0001-0001-0001-000000000001";
    const result = updatePreferredZonesSchema.safeParse({
      zoneIds: [zoneId, zoneId],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zoneIds).toEqual([zoneId]);
    }
  });
});
