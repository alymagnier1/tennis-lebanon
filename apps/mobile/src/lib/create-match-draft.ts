import type { CreateMatchInput } from "@tennis-lebanon/domain";
import { createMatchInputSchema } from "@tennis-lebanon/domain";
import type { SkillBand } from "@tennis-lebanon/domain";

export type Draft = Partial<CreateMatchInput> & {
  selectedSkillBands?: SkillBand[];
  targetPlayerId?: string;
  targetPlayerName?: string;
};

let draft: Draft = {};

export function getCreateMatchDraft(): Draft {
  return { ...draft };
}

export function updateCreateMatchDraft(patch: Draft): Draft {
  draft = { ...draft, ...patch };
  return getCreateMatchDraft();
}

export function resetCreateMatchDraft(): void {
  draft = {};
}

export function buildCreateMatchInput(
  notes?: string,
):
  | { success: true; data: CreateMatchInput }
  | { success: false; error: string } {
  const current = getCreateMatchDraft();

  if (!isCreateMatchDraftReady(current)) {
    return { success: false, error: "incomplete" };
  }

  const parsed = createMatchInputSchema.safeParse({
    ...current,
    notes: notes?.trim() || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    if (path === "proposedTimes") {
      return { success: false, error: "time_in_past" };
    }
    if (path === "preferredClubIds") {
      return { success: false, error: "club_required" };
    }
    return { success: false, error: "invalid" };
  }

  return { success: true, data: parsed.data };
}

export function isCreateMatchDraftReady(
  value: Draft,
): value is CreateMatchInput {
  return Boolean(
    value.format &&
    value.visibility &&
    value.intent &&
    value.minSkill &&
    value.maxSkill &&
    value.requiresCreatorApproval !== undefined &&
    value.zoneIds &&
    value.zoneIds.length > 0 &&
    // Public matches must name a venue; a joiner deciding whether to drive
    // cannot do it on a zone alone. Absent is treated as empty rather than
    // rejected outright, because prefilled drafts (the invite-a-player flow)
    // never set it and the schema defaults it to [].
    (value.visibility !== "public" ||
      (value.preferredClubIds?.length ?? 0) > 0) &&
    value.proposedTimes &&
    value.proposedTimes.length > 0,
  );
}
