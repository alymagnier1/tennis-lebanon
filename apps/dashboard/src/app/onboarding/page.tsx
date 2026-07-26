import { OnboardingForm } from "@/components/OnboardingForm";
import { RequireAuth } from "@/components/RequireAuth";

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingForm />
    </RequireAuth>
  );
}
