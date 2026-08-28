import { compactJoinedLabel } from "./match-clubs";

/** Area names for the zones-step commitment echo. */
export function joinOnboardingAreaNames(names: readonly string[]): string {
  return compactJoinedLabel([...names], 3) ?? "";
}
