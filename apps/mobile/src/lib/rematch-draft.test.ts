import { describe, expect, it } from "vitest";
import {
  beginRematch,
  buildRematchDraft,
  canOfferRematch,
  resolveRematchOpponents,
  type RematchHubFields,
} from "./rematch-draft";
import {
  getCreateMatchDraft,
  resetCreateMatchDraft,
} from "./create-match-draft";

const VIEWER_ID = "11111111-1111-1111-1111-111111111111";
const OPPONENT_ID = "22222222-2222-2222-2222-222222222222";
const ZONE_ID = "33333333-3333-3333-3333-333333333333";

function sampleHub(
  overrides: Partial<RematchHubFields> = {},
): RematchHubFields {
  return {
    format: "singles",
    intent: "social",
    min_skill: "improving",
    max_skill: "advanced",
    zones: [{ id: ZONE_ID, slug: "beirut" }],
    ...overrides,
  };
}

const OPPONENT = { userId: OPPONENT_ID, displayName: "Rami" };

describe("resolveRematchOpponents", () => {
  it("keeps accepted participants other than the viewer", () => {
    expect(
      resolveRematchOpponents(
        [
          { user_id: VIEWER_ID, display_name: "You", status: "accepted" },
          { user_id: OPPONENT_ID, display_name: "Rami", status: "accepted" },
          { user_id: "44444444", display_name: "Left", status: "left" },
        ],
        VIEWER_ID,
      ),
    ).toEqual([{ userId: OPPONENT_ID, displayName: "Rami" }]);
  });

  it("tolerates a missing or malformed participants payload", () => {
    expect(resolveRematchOpponents(null, VIEWER_ID)).toEqual([]);
    expect(resolveRematchOpponents([{ user_id: 7 }], VIEWER_ID)).toEqual([]);
  });
});

describe("canOfferRematch", () => {
  const base = {
    matchStatus: "completed",
    viewerStatus: "accepted",
    viewerAttendance: "attended",
    opponentCount: 1,
  };

  it("offers a rematch once the match is completed and the viewer played", () => {
    expect(canOfferRematch(base)).toBe(true);
  });

  it("still offers one when the match completed on the grace window", () => {
    expect(canOfferRematch({ ...base, viewerAttendance: "unknown" })).toBe(
      true,
    );
    expect(canOfferRematch({ ...base, viewerAttendance: null })).toBe(true);
  });

  it("stays quiet when the viewer did not play", () => {
    expect(canOfferRematch({ ...base, viewerAttendance: "no_show" })).toBe(
      false,
    );
    expect(canOfferRematch({ ...base, viewerAttendance: "late_cancel" })).toBe(
      false,
    );
  });

  it("stays quiet before the match is over, or without an opponent", () => {
    expect(canOfferRematch({ ...base, matchStatus: "confirmed" })).toBe(false);
    expect(canOfferRematch({ ...base, matchStatus: "cancelled" })).toBe(false);
    expect(canOfferRematch({ ...base, viewerStatus: "left" })).toBe(false);
    expect(canOfferRematch({ ...base, opponentCount: 0 })).toBe(false);
  });
});

describe("buildRematchDraft", () => {
  it("carries the finished match's shape over to the new one", () => {
    expect(buildRematchDraft(sampleHub(), OPPONENT)).toMatchObject({
      format: "singles",
      intent: "social",
      minSkill: "improving",
      maxSkill: "advanced",
      selectedSkillBands: ["improving", "intermediate", "advanced"],
      visibility: "invite_only",
      requiresCreatorApproval: false,
      zoneIds: [ZONE_ID],
      timingMode: "fixed",
      targetPlayerId: OPPONENT_ID,
      targetPlayerName: "Rami",
    });
  });

  it("never copies the old hour forward", () => {
    expect(
      buildRematchDraft(sampleHub(), OPPONENT).proposedTimes,
    ).toBeUndefined();
  });

  it("keeps doubles as doubles", () => {
    expect(
      buildRematchDraft(sampleHub({ format: "doubles" }), OPPONENT).format,
    ).toBe("doubles");
  });

  it("falls back to a band window when the stored range is unrecognised", () => {
    const draft = buildRematchDraft(
      sampleHub({ min_skill: "not_a_band", max_skill: "not_a_band" }),
      OPPONENT,
    );

    expect(draft.selectedSkillBands).toEqual([
      "improving",
      "intermediate",
      "advanced",
    ]);
    expect(draft.intent).toBe("social");
  });

  it("falls back to an open intent when the stored one is unrecognised", () => {
    expect(
      buildRematchDraft(sampleHub({ intent: "chaos" }), OPPONENT).intent,
    ).toBe("either");
  });
});

describe("beginRematch", () => {
  it("replaces any prior draft and marks the invite target", () => {
    resetCreateMatchDraft();
    // A stale hosted draft must not leak into the rematch.
    beginRematch(sampleHub({ format: "doubles" }), OPPONENT);
    beginRematch(sampleHub(), OPPONENT);

    const draft = getCreateMatchDraft();
    expect(draft.format).toBe("singles");
    expect(draft.inviteForPlayer).toBe(true);
    expect(draft.targetPlayerId).toBe(OPPONENT_ID);
    resetCreateMatchDraft();
  });
});
