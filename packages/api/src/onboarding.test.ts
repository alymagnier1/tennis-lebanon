import { beforeEach, describe, expect, it, vi } from "vitest";
import { POLICY_VERSIONS, type OnboardingInput } from "@tennis-lebanon/domain";
import {
  callerHasPassword,
  completeOnboarding,
  requestAccountDeletion,
} from "./onboarding";
import type { TennisSupabaseClient } from "./client";

const validInput: OnboardingInput = {
  displayName: "Player One",
  birthYear: 1990,
  isAdultConfirmed: true,
  languages: ["en"],
  skillBand: "intermediate",
  playIntent: "either",
  prefersSingles: true,
  prefersDoubles: false,
  zoneIds: ["aaaaaaaa-0001-0001-0001-000000000001"],
  termsVersion: POLICY_VERSIONS.terms,
  privacyVersion: POLICY_VERSIONS.privacy,
  communityRulesVersion: POLICY_VERSIONS.communityRules,
};

function createMockClient() {
  const rpc = vi.fn();
  const client = { rpc } as unknown as TennisSupabaseClient;
  return { client, rpc };
}

describe("onboarding API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps onboarding input to the complete_onboarding RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ error: null });

    await completeOnboarding(client, validInput);

    expect(rpc).toHaveBeenCalledWith("complete_onboarding", {
      p_display_name: validInput.displayName,
      p_birth_year: validInput.birthYear,
      p_is_adult_confirmed: validInput.isAdultConfirmed,
      p_languages: validInput.languages,
      p_skill_band: validInput.skillBand,
      p_play_intent: validInput.playIntent,
      p_prefers_singles: validInput.prefersSingles,
      p_prefers_doubles: validInput.prefersDoubles,
      p_zone_ids: validInput.zoneIds,
      p_terms_version: validInput.termsVersion,
      p_privacy_version: validInput.privacyVersion,
      p_community_rules_version: validInput.communityRulesVersion,
    });
  });

  it("throws when complete_onboarding returns an RPC error", async () => {
    const { client, rpc } = createMockClient();
    const rpcError = { message: "Adult attestation required", code: "22023" };
    rpc.mockResolvedValue({ error: rpcError });

    await expect(completeOnboarding(client, validInput)).rejects.toEqual(
      rpcError,
    );
  });

  it("calls request_account_deletion without arguments", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ error: null });

    await requestAccountDeletion(client);

    expect(rpc).toHaveBeenCalledWith("request_account_deletion");
  });

  it("throws when request_account_deletion returns an RPC error", async () => {
    const { client, rpc } = createMockClient();
    const rpcError = { message: "Authentication required", code: "42501" };
    rpc.mockResolvedValue({ error: rpcError });

    await expect(requestAccountDeletion(client)).rejects.toEqual(rpcError);
  });
});

describe("callerHasPassword", () => {
  it("asks the server, with no arguments to point anywhere else", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(callerHasPassword(client)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("caller_has_password");
  });

  // A Google-created account. The caller uses this to decide whether to offer
  // "Set a password", so a false has to survive as false.
  it("reports an account with no password", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(callerHasPassword(client)).resolves.toBe(false);
  });

  // Never render the row on a maybe: null and undefined mean the question was
  // not answered, and `data === true` keeps them out of the truthy branch.
  it("treats a missing answer as no answer, not as a password", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(callerHasPassword(client)).resolves.toBe(false);
  });

  it("throws when the RPC fails", async () => {
    const { client, rpc } = createMockClient();
    const rpcError = { message: "Authentication required", code: "42501" };
    rpc.mockResolvedValue({ error: rpcError });

    await expect(callerHasPassword(client)).rejects.toEqual(rpcError);
  });
});
