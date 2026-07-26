import { CourtsEditor } from "@/components/CourtsEditor";
import { RequireAuth } from "@/components/RequireAuth";

export default function CourtsPage() {
  return (
    <RequireAuth>
      <CourtsEditor />
    </RequireAuth>
  );
}
