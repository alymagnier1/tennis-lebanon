import { describe, expect, it } from "vitest";
import { openMatchCardDateTimeLabel } from "./open-match-card-time";
import type { OpenMatchCard } from "@tennis-lebanon/api";

function baseMatch(
  proposed_times: OpenMatchCard["proposed_times"],
): OpenMatchCard {
  return {
    match_id: "m1",
    format: "singles",
    intent: "social",
    visibility: "public",
    status: "open",
    requires_creator_approval: false,
    min_skill: "beginner",
    max_skill: "advanced",
    zones: [],
    preferred_clubs: [],
    proposed_times,
    participant_count: 1,
    capacity: 2,
    creator_display_name: "Player A",
    creator_avatar_path: null,
    notes: null,
    level_fit: true,
    zone_overlap: true,
    availability_overlap: true,
    created_at: "2026-08-01T10:00:00.000Z",
    court_secured: false,
    court_club_name: null,
  };
}

describe("openMatchCardDateTimeLabel", () => {
  it("formats the soonest proposed slot", () => {
    const label = openMatchCardDateTimeLabel(
      baseMatch([
        {
          starts_at: "2026-08-11T15:00:00.000Z",
          ends_at: "2026-08-11T16:00:00.000Z",
        },
      ]),
    );

    expect(label).toBeTruthy();
    expect(label).toMatch(/^\w{3} \d{1,2}, /);
  });

  it("returns undefined when no slots are parseable", () => {
    expect(openMatchCardDateTimeLabel(baseMatch([]))).toBeUndefined();
  });
});
