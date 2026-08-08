import type { OwnPlayerProfile } from "@tennis-lebanon/api";
import {
  buildCreateMatchDraftFromHostDefaults,
  matchHostDefaultsRowFromProfile,
  resolveMatchHostDefaults,
} from "@tennis-lebanon/domain";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "./create-match-draft";

export function hydrateCreateMatchDraftFromProfile(
  profile: OwnPlayerProfile,
  zoneIds: string[],
): void {
  const row = matchHostDefaultsRowFromProfile(profile);
  const resolved = resolveMatchHostDefaults(row);
  const patch = buildCreateMatchDraftFromHostDefaults(resolved, zoneIds);

  updateCreateMatchDraft({
    format: patch.format,
    intent: patch.intent,
    minSkill: patch.minSkill,
    maxSkill: patch.maxSkill,
    selectedSkillBands: patch.selectedSkillBands,
    visibility: patch.visibility,
    requiresCreatorApproval: patch.requiresCreatorApproval,
    timingMode: patch.timingMode,
    zoneIds: patch.zoneIds,
  });
}

export function createMatchDraftHasInviteTarget(): boolean {
  const draft = getCreateMatchDraft();
  return Boolean(draft.inviteForPlayer && draft.targetPlayerId);
}
