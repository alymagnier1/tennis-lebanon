import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import {
  resetCreateMatchDraft,
  updateCreateMatchDraft,
} from "./create-match-draft";
import { prefillCreateMatchDraftForPlayer } from "./prefill-create-match-for-player";

export function beginCreateMatchForPlayer(player: CompatiblePlayerCard): void {
  resetCreateMatchDraft();
  updateCreateMatchDraft(prefillCreateMatchDraftForPlayer(player));
}
