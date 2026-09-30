import { describe, expect, it } from "vitest";
import { openMatchRosterProps } from "./open-match-roster";

const t = (key: string, options?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(options ?? {})}`;

describe("openMatchRosterProps", () => {
  it("keeps the host's full name and no stack while the host is alone", () => {
    expect(
      openMatchRosterProps(
        {
          participants: [{ display_name: "Bassem Zein", avatar_path: null }],
          participant_count: 1,
          creator_display_name: "Bassem Zein",
        },
        t,
      ),
    ).toEqual({ headline: "Bassem Zein" });
  });

  it("shortens the host's name once faces are stacked beside it", () => {
    const props = openMatchRosterProps(
      {
        participants: [
          { display_name: "Aly Magnier", avatar_path: null },
          { display_name: "Rana", avatar_path: null },
        ],
        participant_count: 2,
        creator_display_name: "Aly Magnier",
      },
      t,
    );

    expect(props.headline).toBe("Aly M.");
    expect(props.hostOthers?.accessibilityLabel).toContain("Aly Magnier");
  });

  it("lists everyone, host first, and counts the others", () => {
    const props = openMatchRosterProps(
      {
        participants: [
          { display_name: "Bassem", avatar_path: "b.jpg" },
          { display_name: "Aly", avatar_path: null },
          { display_name: "Rana", avatar_path: "r.jpg" },
        ],
        participant_count: 3,
        creator_display_name: "Bassem",
      },
      t,
    );

    expect(props.hostRoster).toEqual([
      { name: "Bassem", avatarPath: "b.jpg" },
      { name: "Aly", avatarPath: null },
      { name: "Rana", avatarPath: "r.jpg" },
    ]);
    expect(props.hostOthers).toEqual({
      label: 'discover.rosterMore:{"count":2}',
      accessibilityLabel: 'discover.rosterA11y:{"name":"Bassem","count":2}',
    });
  });

  it("counts a player the server left out of the roster", () => {
    const props = openMatchRosterProps(
      {
        participants: [{ display_name: "Bassem", avatar_path: null }],
        participant_count: 2,
        creator_display_name: "Bassem",
      },
      t,
    );

    expect(props.hostRoster).toHaveLength(1);
    expect(props.hostOthers?.label).toBe('discover.rosterMore:{"count":1}');
  });
});
