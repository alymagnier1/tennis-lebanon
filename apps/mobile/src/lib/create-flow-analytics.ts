import { routeStepSlug, trackEvent, type RematchSurface } from "./analytics";

/**
 * Create-flow instrumentation, and the one event here that needs memory.
 *
 * `create_abandoned` means "left the create flow without publishing", which no
 * single button press expresses — the host simply goes somewhere else. So the
 * flow keeps two facts for the life of the stack: the last step seen, and
 * whether a publish succeeded. The layout emits on unmount, using both.
 *
 * Module-level state rather than React state on purpose: it has to survive
 * navigation between `schedule` and `details`, outlive the screen that recorded
 * it, and still be readable from `usePublishMatch`, which is not a child of the
 * layout. `create-match-draft.ts` holds the draft the same way for the same
 * reason.
 *
 * Known gap: if the app is killed mid-flow the unmount never runs and the
 * abandonment is not recorded, so treat the abandon count as a floor.
 */

let lastStep: string | null = null;
let published = false;

/** Called when the create stack mounts, so a previous flow cannot leak in. */
export function beginCreateFlowTracking(): void {
  lastStep = null;
  published = false;
}

/**
 * True for the create stack's loader, which redirects to `schedule` within a
 * frame. `usePathname()` reports it as `/match/create` rather than
 * `/match/create/index`, so filtering on the slug alone would have quietly
 * recorded a phantom step called `create` — matching on the path shape states
 * the actual rule.
 */
function isCreateLoaderPath(pathname: string): boolean {
  return /\/create(\/index)?\/?$/.test(pathname);
}

export function trackCreateStep(pathname: string | null | undefined): void {
  const path = pathname ?? "";
  if (isCreateLoaderPath(path)) {
    return;
  }

  const step = routeStepSlug(path);
  if (!step) {
    return;
  }

  lastStep = step;
  trackEvent("create_step_viewed", { step });
}

/**
 * Marks the flow as successful. Must run before the post-publish navigation, or
 * the unmount would read `published` as false and log a false abandonment.
 */
export function markCreateFlowPublished(): void {
  published = true;
}

/** Emits `rematch_published` only when the draft actually came from a rematch. */
export function trackRematchPublished(surface: string | undefined): void {
  if (!surface) {
    return;
  }

  trackEvent("rematch_published", { surface: surface as RematchSurface });
}

/**
 * Called when the create stack unmounts. Emits `create_abandoned` only if the
 * host reached a real step and never published.
 */
export function trackCreateFlowExit(): void {
  if (!published && lastStep) {
    trackEvent("create_abandoned", { step: lastStep });
  }

  lastStep = null;
  published = false;
}

/** Test seam. */
export function __resetCreateFlowTrackingForTest(): void {
  lastStep = null;
  published = false;
}
