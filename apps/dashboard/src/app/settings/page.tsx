import { ClubSettingsForm } from "@/components/ClubSettingsForm";
import { RequireAuth } from "@/components/RequireAuth";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <ClubSettingsForm />
    </RequireAuth>
  );
}
