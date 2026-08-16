export type HubPrimaryActionKind =
  | "join"
  | "request_join"
  | "invite"
  | "request_court"
  | "continue_setup"
  | "confirm_external_court"
  | "none";

export function resolveHubPrimaryAction(input: {
  nextAction?: string | null;
  joinAction: "none" | "join" | "request";
  showRequestCourt: boolean;
  showConfirmExternalCourt: boolean;
  isDraftCreator: boolean;
  viewerIsCreator?: boolean;
  /** Host still has open roster slots and may invite. */
  canInvite?: boolean;
}): HubPrimaryActionKind {
  if (input.isDraftCreator) {
    return "continue_setup";
  }

  if (input.joinAction === "join") {
    return "join";
  }

  if (input.joinAction === "request") {
    return "request_join";
  }

  // Booking and invite are host-only; joiners wait.
  if (input.viewerIsCreator === false) {
    return "none";
  }

  if (input.showRequestCourt) {
    return "request_court";
  }

  if (input.showConfirmExternalCourt) {
    return "confirm_external_court";
  }

  // Prefer the hub next_action, but also invite whenever the host still has
  // open slots — some open listings report a different next_action while
  // recruiting, and the vs-hero used to hide the footer Invite entirely.
  if (input.nextAction === "awaiting_players" || input.canInvite) {
    return "invite";
  }

  return "none";
}

export function hubPrimaryActionLabelKey(
  kind: HubPrimaryActionKind,
): string | null {
  switch (kind) {
    case "join":
      return "matches.hub.join";
    case "request_join":
      return "matches.hub.requestJoin";
    case "invite":
      return "matches.invite.invitePlayers";
    case "request_court":
      return "matches.hub.requestCourt";
    case "continue_setup":
      return "matches.hub.continueSetup";
    case "confirm_external_court":
      return "matches.booking.bookedOffAppCta";
    default:
      return null;
  }
}
