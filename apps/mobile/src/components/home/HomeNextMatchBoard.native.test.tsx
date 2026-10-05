/// <reference types="jest" />

import "../../lib/i18n";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import type { MyMatchRow } from "@tennis-lebanon/api";
import { HomeNextMatchBoard } from "./HomeNextMatchBoard";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

// No photo lookups: the avatars fall back to initials.
jest.mock("../../lib/use-avatar-url", () => ({
  useAvatarUrl: () => ({ data: null, isLoading: false, isError: false }),
}));

const openSingles: MyMatchRow = {
  match_id: "match-1",
  format: "singles",
  status: "open",
  visibility: "public",
  intent: "casual",
  participant_status: "accepted",
  is_creator: true,
  viewer_attendance: null,
  participant_count: 1,
  capacity: 2,
  soonest_time: "2026-10-06T15:00:00Z",
  notes: null,
  updated_at: "2026-10-04T08:00:00Z",
  listing_expires_at: null,
  is_stale_warning: false,
  can_extend_listing: false,
  has_court: false,
  court_starts_at: null,
  opponent_names: null,
  club_name: null,
  preferred_clubs: null,
  zones: null,
  unread_message_count: 0,
  pending_request_count: 0,
};

describe("HomeNextMatchBoard", () => {
  afterEach(async () => {
    mockPush.mockClear();
    await cleanup();
  });

  it("gives the invite button its own row and opens the invite screen", async () => {
    const view = await render(
      <HomeNextMatchBoard match={openSingles} viewerName="Bassem" />,
    );

    expect(view.getByText("1 spot left")).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Invite players" }));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("shows no invite button once the match is full", async () => {
    const view = await render(
      <HomeNextMatchBoard
        match={{
          ...openSingles,
          status: "ready_to_book",
          participant_count: 2,
          opponent_names: "Rami",
        }}
        viewerName="Bassem"
      />,
    );

    expect(view.queryByRole("button", { name: "Invite players" })).toBeNull();
  });
});
