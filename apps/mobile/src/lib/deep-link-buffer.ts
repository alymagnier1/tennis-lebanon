type UrlEvent = { url: string };

type LinkingLike = {
  addEventListener: (
    type: "url",
    handler: (event: UrlEvent) => void,
  ) => { remove: () => void };
};

let latest: string | null = null;
let installed = false;

/**
 * Captures deep links from app startup, not from the screen that consumes them.
 *
 * A link that resumes an already-running app fires its `url` event while
 * expo-router is still routing -- before the destination screen mounts. A
 * listener added inside that screen's effect (which is what `Linking.useURL()`
 * does) is installed too late and never hears it, and `getInitialURL()` returns
 * null because the link did not launch the app. The screen then has no URL at
 * all, which is how a sign-in the server had already completed still showed
 * "This sign-in link is invalid or expired".
 *
 * Installed from the root layout at module scope, so the listener exists before
 * any link can arrive. Takes `Linking` as an argument to keep this file free of
 * native imports and therefore testable under vitest's node environment.
 */
export function installDeepLinkCapture(linking: LinkingLike): () => void {
  if (installed) return () => {};
  installed = true;
  const subscription = linking.addEventListener("url", ({ url }) => {
    latest = url;
  });
  return () => {
    subscription.remove();
    installed = false;
  };
}

/** The most recent deep link, or null. Safe to call before install. */
export function peekCapturedDeepLink(): string | null {
  return latest;
}

export function resetDeepLinkCaptureForTests(): void {
  latest = null;
  installed = false;
}
