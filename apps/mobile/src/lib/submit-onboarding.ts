import { completeOnboarding, setOwnGender } from "@tennis-lebanon/api";
import { POLICY_VERSIONS, onboardingInputSchema } from "@tennis-lebanon/domain";
import type { OnboardingDraft } from "../providers/OnboardingProvider";
import { supabase } from "./supabase";

/**
 * Writes the onboarding draft as a completed profile. Gender is optional and
 * stored after the profile exists, matching the previous review-screen path.
 */
export async function submitOnboardingDraft(
  draft: OnboardingDraft,
): Promise<void> {
  const input = onboardingInputSchema.parse({
    displayName: draft.displayName,
    birthYear: Number(draft.birthYear),
    isAdultConfirmed: draft.isAdultConfirmed,
    languages: draft.languages,
    skillBand: draft.skillBand,
    playIntent: draft.playIntent,
    prefersSingles: draft.prefersSingles,
    prefersDoubles: draft.prefersDoubles,
    zoneIds: draft.zoneIds,
    termsVersion: POLICY_VERSIONS.terms,
    privacyVersion: POLICY_VERSIONS.privacy,
    communityRulesVersion: POLICY_VERSIONS.communityRules,
  });
  await completeOnboarding(supabase, input);

  if (draft.gender) {
    await setOwnGender(supabase, draft.gender);
  }
}
