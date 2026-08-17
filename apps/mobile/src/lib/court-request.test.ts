import { describe, expect, it } from "vitest";
import type { MatchCourtRequest } from "@tennis-lebanon/api";
import {
  courtRequestClubCount,
  latestSentCourtRequest,
  pendingCourtRequest,
} from "./court-request";

function request(
  overrides: Partial<MatchCourtRequest> = {},
): MatchCourtRequest {
  return {
    request_id: "req-1",
    club_id: "club-1",
    club_name: "Pilot Tennis Club",
    status: "opened",
    opened_at: "2026-08-16T13:00:00.000Z",
    answered_at: null,
    is_viewer_request: true,
    ...overrides,
  };
}

describe("pendingCourtRequest", () => {
  it("returns the host's unanswered reach-out", () => {
    expect(pendingCourtRequest([request()], true)?.request_id).toBe("req-1");
  });

  it("stays quiet for a joiner, who cannot answer it", () => {
    expect(pendingCourtRequest([request()], false)).toBeNull();
  });

  it("ignores a reach-out opened by somebody else", () => {
    expect(
      pendingCourtRequest([request({ is_viewer_request: false })], true),
    ).toBeNull();
  });

  it("ignores already-answered reach-outs", () => {
    expect(pendingCourtRequest([request({ status: "sent" })], true)).toBeNull();
    expect(
      pendingCourtRequest([request({ status: "not_sent" })], true),
    ).toBeNull();
  });

  it("picks the newest when several clubs were tried", () => {
    const picked = pendingCourtRequest(
      [
        request({ request_id: "old", opened_at: "2026-08-16T09:00:00.000Z" }),
        request({
          request_id: "new",
          club_id: "club-2",
          opened_at: "2026-08-16T15:00:00.000Z",
        }),
      ],
      true,
    );

    expect(picked?.request_id).toBe("new");
  });

  it("handles a match nobody has taken to a club yet", () => {
    expect(pendingCourtRequest([], true)).toBeNull();
  });
});

describe("latestSentCourtRequest", () => {
  it("returns the newest confirmed reach-out, whoever opened it", () => {
    const sent = latestSentCourtRequest([
      request({
        request_id: "a",
        status: "sent",
        opened_at: "2026-08-16T09:00:00.000Z",
        is_viewer_request: false,
      }),
      request({
        request_id: "b",
        status: "sent",
        club_id: "club-2",
        opened_at: "2026-08-16T15:00:00.000Z",
        is_viewer_request: false,
      }),
    ]);

    expect(sent?.request_id).toBe("b");
  });

  it("does not count an unanswered or abandoned reach-out as asked", () => {
    expect(latestSentCourtRequest([request({ status: "opened" })])).toBeNull();
    expect(
      latestSentCourtRequest([request({ status: "not_sent" })]),
    ).toBeNull();
  });
});

describe("courtRequestClubCount", () => {
  it("counts distinct clubs, not attempts", () => {
    expect(
      courtRequestClubCount([
        request({ club_id: "club-1" }),
        request({ club_id: "club-1", status: "not_sent" }),
        request({ club_id: "club-2" }),
      ]),
    ).toBe(2);
  });

  it("is zero before anyone reaches out", () => {
    expect(courtRequestClubCount([])).toBe(0);
  });
});
