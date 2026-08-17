import type { PushPermissionState } from "./push-notifications";

/**
 * The contextual push ask — decision only, no I/O.
 *
 * Onboarding already primes notifications with four benefit cards, and its
 * "Not now" never fires the OS prompt — so the one-shot system prompt is not
 * burned on an unmotivated user. What onboarding cannot do is make the benefit
 * concrete: at step five nobody has a match, so "we'll tell you when someone
 * replies" is hypothetical. A player who taps "Not now" is then only recoverable
 * if they go looking in Profile → Notifications, which almost nobody does.
 *
 * So this is an *additional* ask at the first moment the benefit is real — the
 * player is on a match hub with a named opponent — shown exactly once per account
 * per device. After that the settings screen owns it. Nagging a weekly-sport user
 * is how push permission gets revoked for good.
 *
 * Kept free of react-native and storage imports so it stays unit-testable; the
 * persistence lives in `push-nudge-storage.ts`, mirroring how `push-settings.ts`
 * is pure while `push-notifications.ts` holds the platform calls.
 */

export type PushNudgeDecision =
  /** Show nothing. */
  | "hidden"
  /** The OS will still show its prompt; offer to enable. */
  | "ask"
  /** The OS will not ask again; the only route left is system settings. */
  | "openSettings";

export function decidePushNudge(input: {
  permission: PushPermissionState;
  /** Whether this account has already seen the nudge on this device. */
  alreadyAsked: boolean;
  /** Only accepted participants have anything to be notified about. */
  viewerIsParticipant: boolean;
}): PushNudgeDecision {
  if (!input.viewerIsParticipant || input.alreadyAsked) {
    return "hidden";
  }

  switch (input.permission.status) {
    // Web, a simulator, or a build that can never receive a token. Offering a
    // button here would be a lie — the same reason derivePushSettingsView keeps
    // `unsupported` apart from `blocked`.
    case "unsupported":
      return "hidden";
    case "granted":
      return "hidden";
    case "denied":
      return input.permission.canAskAgain ? "ask" : "openSettings";
    case "undetermined":
      return "ask";
    default:
      return "hidden";
  }
}
