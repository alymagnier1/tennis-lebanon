import type {
  PushPermissionState,
  PushRegistrationResult,
} from "./push-notifications";

/**
 * What the notification settings screen shows, derived from the OS permission
 * and the result of the last (silent) registration attempt.
 *
 * `blocked` and `unsupported` are kept apart on purpose. Blocked is the user's
 * own past "don't allow" and is recoverable from system settings; unsupported
 * means this build or device can never deliver push regardless of what the user
 * does, so offering them a button would be a lie.
 */
export type PushSettingsTone = "on" | "off" | "blocked" | "unsupported";

export type PushSettingsAction = "enable" | "openSettings" | "none";

export type PushSettingsView = {
  tone: PushSettingsTone;
  statusKey: string;
  detailKey: string;
  action: PushSettingsAction;
};

export function derivePushSettingsView(input: {
  permission: PushPermissionState;
  /** Result of the last silent sync, or null before one has run. */
  registration: PushRegistrationResult | null;
}): PushSettingsView {
  const { permission, registration } = input;

  // A build with no Expo project id cannot register a token even after the
  // user allows notifications, so this outranks the permission state: saying
  // "notifications are on" here would be false.
  if (registration === "unconfigured") {
    return {
      tone: "unsupported",
      statusKey: "notifications.settings.statusUnsupported",
      detailKey: "notifications.settings.detailUnconfigured",
      action: "none",
    };
  }

  if (permission.status === "unsupported") {
    return {
      tone: "unsupported",
      statusKey: "notifications.settings.statusUnsupported",
      detailKey: "notifications.settings.detailUnsupported",
      action: "none",
    };
  }

  if (permission.status === "granted") {
    // Permission is granted but no token came back — a simulator, or a device
    // the push service refused. Nothing the user can fix from here.
    if (registration === "unavailable") {
      return {
        tone: "unsupported",
        statusKey: "notifications.settings.statusUnsupported",
        detailKey: "notifications.settings.detailUnsupported",
        action: "none",
      };
    }

    return {
      tone: "on",
      statusKey: "notifications.settings.statusOn",
      detailKey: "notifications.settings.detailOn",
      action: "none",
    };
  }

  if (permission.status === "denied") {
    return {
      tone: "blocked",
      statusKey: "notifications.settings.statusBlocked",
      detailKey: "notifications.settings.detailBlocked",
      action: "openSettings",
    };
  }

  return {
    tone: "off",
    statusKey: "notifications.settings.statusOff",
    detailKey: "notifications.settings.detailOff",
    action: "enable",
  };
}

/**
 * Whether a just-finished enable attempt should surface an error. "denied" is
 * not one: the user declining the OS prompt is an answer, not a failure, and
 * the status line already reflects it.
 */
export function isEnableFailure(result: PushRegistrationResult): boolean {
  return result === "unavailable" || result === "unconfigured";
}
