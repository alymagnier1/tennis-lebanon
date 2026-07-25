import type { OnboardingInput } from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export async function getOwnProfile(client: TennisSupabaseClient) {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActiveZones(client: TennisSupabaseClient) {
  const { data, error } = await client
    .from("zones")
    .select(
      "id,country_code,city_code,slug,name_i18n,timezone,is_active,sort_order",
    )
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return data;
}

export async function completeOnboarding(
  client: TennisSupabaseClient,
  input: OnboardingInput,
) {
  const { error } = await client.rpc("complete_onboarding", {
    p_display_name: input.displayName,
    p_birth_year: input.birthYear,
    p_is_adult_confirmed: input.isAdultConfirmed,
    p_languages: input.languages,
    p_skill_band: input.skillBand,
    p_play_intent: input.playIntent,
    p_prefers_singles: input.prefersSingles,
    p_prefers_doubles: input.prefersDoubles,
    p_zone_ids: input.zoneIds,
    p_terms_version: input.termsVersion,
    p_privacy_version: input.privacyVersion,
    p_community_rules_version: input.communityRulesVersion,
  });

  if (error) throw error;
}

export async function requestAccountDeletion(client: TennisSupabaseClient) {
  const { error } = await client.rpc("request_account_deletion");
  if (error) throw error;
}
