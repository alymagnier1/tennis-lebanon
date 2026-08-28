import type { OpenMatchCard } from "@tennis-lebanon/api";

export type CompleteGiftState =
  | { kind: "pending" }
  | { kind: "error" }
  | { kind: "listings"; matches: OpenMatchCard[] }
  | { kind: "empty" };

/** Gift listings only when the overlapping query succeeded. */
export function completeGiftState(input: {
  isPending: boolean;
  isError: boolean;
  matches: OpenMatchCard[];
}): CompleteGiftState {
  if (input.isPending) return { kind: "pending" };
  if (input.isError) return { kind: "error" };
  if (input.matches.length > 0) {
    return { kind: "listings", matches: input.matches };
  }
  return { kind: "empty" };
}
