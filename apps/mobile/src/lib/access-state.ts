export type AccessState =
  | "loading"
  | "anonymous"
  | "needsOnboarding"
  | "ready"
  | "suspended"
  | "deletionRequested"
  | "error";

interface AccessProfile {
  account_status: "active" | "suspended" | "deletion_requested" | "deleted";
  onboarding_completed_at: string | null;
}

export function deriveAccessState(
  hasSession: boolean,
  profile: AccessProfile | null,
  isLoading: boolean,
  hasError: boolean,
): AccessState {
  if (isLoading) return "loading";
  if (!hasSession) return "anonymous";
  if (hasError) return "error";
  if (profile?.account_status === "suspended") return "suspended";
  if (
    profile?.account_status === "deletion_requested" ||
    profile?.account_status === "deleted"
  ) {
    return "deletionRequested";
  }
  if (!profile?.onboarding_completed_at) return "needsOnboarding";
  return "ready";
}
