/**
 * One Expo push message. Kept free of imports so the app's vitest project can
 * test it: the rest of `_shared` uses Deno's `.ts` import specifiers, which
 * the app's TypeScript settings reject.
 */
export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  priority: "high";
  data: {
    deepLink: string;
    kind: string;
  };
};

export function expoPushMessage(
  fields: Omit<ExpoPushMessage, "priority">,
): ExpoPushMessage {
  return {
    ...fields,
    // Without it Expo sends Android pushes at "normal" priority, which Expo
    // documents as not opening network connections on sleeping devices: a
    // join, a court confirmation or a message waited until the phone was
    // picked up (seen 2026-09-26). Every push here is shown to the player, so
    // high priority is what Android expects of it. No `channelId`: a channel
    // the app never created would hide the notification, and Expo's default
    // channel shows it.
    priority: "high",
  };
}
