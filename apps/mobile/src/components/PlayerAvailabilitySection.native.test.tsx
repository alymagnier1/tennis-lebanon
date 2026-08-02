/// <reference types="jest" />

import "../lib/i18n";
import { render } from "@testing-library/react-native";
import type {
  CompatiblePlayerCard,
  PublicPlayerAvailabilitySummary,
} from "@tennis-lebanon/api";
import { PlayerAvailabilitySection } from "./player/PlayerAvailabilitySection";
import { EmptyState } from "./AppUi";

// Extended_Pictographic rather than hand-picked ranges: it is the Unicode
// property that means "emoji", so it catches new ones without maintenance.
// Hand-rolled ranges missed U+23F0 (the alarm clock this replaced), which sits
// below the block people usually reach for.
const EMOJI = /\p{Extended_Pictographic}/u;

function player(): CompatiblePlayerCard {
  return {
    user_id: "player-1",
    display_name: "Player",
    avatar_path: null,
    skill_band: "intermediate",
    play_intent: "social",
    prefers_singles: true,
    prefers_doubles: false,
    zones: [],
    provisional_rating_label: "provisional",
    display_rating: null,
    completed_match_count: 0,
    level_fit: true,
    zone_overlap: true,
    availability_overlap: true,
    intent_fit: true,
    format_fit: true,
    overlap_starts_at: null,
    overlap_ends_at: null,
    bio: null,
    availability_weekdays: [],
    availability_day_parts: [],
    near_term_slots: [],
    near_term_overlap_slots: [],
  };
}

const summary: PublicPlayerAvailabilitySummary = {
  weekdays: [5, 6],
  day_parts: ["morning", "evening"],
};

describe("player profile availability lines", () => {
  it("renders the format and intent lines", async () => {
    const view = await render(
      <PlayerAvailabilitySection player={player()} summary={summary} />,
    );

    // The weekday chips come from the summary, so a rendered chip proves the
    // section got past its own empty state.
    expect(view.getByText("Fri")).toBeTruthy();
    expect(view.getByText("Sat")).toBeTruthy();
  });

  it("uses icons rather than emoji", async () => {
    const view = await render(
      <PlayerAvailabilitySection player={player()} summary={summary} />,
    );

    expect(JSON.stringify(view.toJSON())).not.toMatch(EMOJI);
  });

  it("renders an empty state without emoji", async () => {
    const view = await render(
      <EmptyState title="Nothing here" body="Try widening your filters." />,
    );

    expect(view.getByText("Nothing here")).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toMatch(EMOJI);
  });
});
