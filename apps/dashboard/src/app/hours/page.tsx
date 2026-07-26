import { HoursEditor } from "@/components/HoursEditor";
import { RequireAuth } from "@/components/RequireAuth";

export default function HoursPage() {
  return (
    <RequireAuth>
      <HoursEditor />
    </RequireAuth>
  );
}
