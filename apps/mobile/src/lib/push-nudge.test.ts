import { describe, expect, it } from "vitest";
import { decidePushNudge } from "./push-nudge";
import type { PushPermissionStatus } from "./push-notifications";

function permission(
  status: PushPermissionStatus,
  canAskAgain = status === "undetermined",
) {
  return { status, canAskAgain };
}

const base = {
  permission: permission("undetermined"),
  alreadyAsked: false,
  viewerIsParticipant: true,
};

describe("decidePushNudge", () => {
  it("asks an accepted participant who has not been asked", () => {
    expect(decidePushNudge(base)).toBe("ask");
  });

  it("stays hidden for someone who is not a participant", () => {
    // Nothing is waiting on them yet, so there is nothing to promise.
    expect(decidePushNudge({ ...base, viewerIsParticipant: false })).toBe(
      "hidden",
    );
  });

  it("asks only once per account per device", () => {
    expect(decidePushNudge({ ...base, alreadyAsked: true })).toBe("hidden");
  });

  it("stays hidden when permission is already granted", () => {
    expect(
      decidePushNudge({ ...base, permission: permission("granted", false) }),
    ).toBe("hidden");
  });

  it("stays hidden where push can never work, rather than offering a dead button", () => {
    expect(
      decidePushNudge({
        ...base,
        permission: permission("unsupported", false),
      }),
    ).toBe("hidden");
  });

  it("points a blocked user at system settings, the only route left", () => {
    expect(
      decidePushNudge({ ...base, permission: permission("denied", false) }),
    ).toBe("openSettings");
  });

  it("still asks when the OS says it will prompt again", () => {
    expect(
      decidePushNudge({ ...base, permission: permission("denied", true) }),
    ).toBe("ask");
  });

  it("never shows anything once asked, whatever the permission state", () => {
    for (const status of [
      "granted",
      "denied",
      "undetermined",
      "unsupported",
    ] as PushPermissionStatus[]) {
      expect(
        decidePushNudge({
          ...base,
          alreadyAsked: true,
          permission: permission(status),
        }),
      ).toBe("hidden");
    }
  });
});
