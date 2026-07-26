import type { CreateMatchInput } from "@tennis-lebanon/domain";
import { createMatchInputSchema } from "@tennis-lebanon/domain";
import type { SkillBand } from "@tennis-lebanon/domain";

type Draft = Partial<CreateMatchInput> & {
  selectedSkillBands?: SkillBand[];
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
    if (issue?.path.join(".") === "proposedTimes") {
      return { success: false, error: "time_in_past" };
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
    value.proposedTimes &&
    value.proposedTimes.length > 0,
  );
}
