import { describe, expect, it } from "vitest";
import { beirutLocalToUtcIso, utcIsoToBeirutFields } from "./beirut-time";

describe("beirut-time", () => {
  // The wizard builds proposed_times from these, so getting the offset wrong
  // silently stores every match two or three hours late. An earlier version
  // compared against the requested hour rather than the rendered one, which
  // collapsed the offset to zero and made this an identity on Date.UTC.
  describe("beirutLocalToUtcIso", () => {
    it("applies the summer offset", () => {
      expect(beirutLocalToUtcIso("2026-08-07", "18:00")).toBe(
        "2026-08-07T15:00:00.000Z",
      );
    });

    it("applies the winter offset", () => {
      expect(beirutLocalToUtcIso("2026-01-15", "18:00")).toBe(
        "2026-01-15T16:00:00.000Z",
      );
    });

    it("walks back a day when the offset crosses midnight", () => {
      expect(beirutLocalToUtcIso("2026-08-07", "00:30")).toBe(
        "2026-08-06T21:30:00.000Z",
      );
    });

    it("never simply reinterprets the wall clock as UTC", () => {
      expect(beirutLocalToUtcIso("2026-08-07", "18:00")).not.toBe(
        "2026-08-07T18:00:00.000Z",
      );
    });
  });

  // The off-app court screen seeds its picker from the agreed slot and then
  // compares the two instants to decide whether the match has moved. A lossy
  // round trip would warn that every booking changed the time.
  describe("round trip", () => {
    for (const iso of [
      "2026-08-07T15:00:00+00:00",
      "2026-01-15T16:00:00+00:00",
      "2026-08-06T21:30:00+00:00",
    ]) {
      it(`survives ${iso}`, () => {
        const { date, time } = utcIsoToBeirutFields(iso);
        expect(new Date(beirutLocalToUtcIso(date, time)).getTime()).toBe(
          new Date(iso).getTime(),
        );
      });
    }
  });
});
