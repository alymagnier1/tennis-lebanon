/**
 * What to do at launch about Android's native right-to-left flag.
 *
 * Screens mirror themselves for Arabic (`useLayoutDirection`), so native
 * layout must stay left to right in every language: native mirroring on top
 * flips Arabic rows back, and a flag left on kept English laid out right to
 * left until the app was restarted (founder, 2026-10-03).
 *
 * The flag is read when the app starts, so a launch that finds it on has to
 * restart once after clearing it. Only once: if it is somehow still on after
 * that restart, carry on rather than restart in a loop.
 */
export function nativeLayoutStartupAction({
  nativeIsRtl,
  restartAlreadyTried,
}: {
  nativeIsRtl: boolean;
  restartAlreadyTried: boolean;
}): "none" | "restart" | "give_up" {
  if (!nativeIsRtl) return "none";
  return restartAlreadyTried ? "give_up" : "restart";
}
