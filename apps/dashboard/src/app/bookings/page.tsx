import { BookingsQueue } from "@/components/BookingsQueue";
import { RequireAuth } from "@/components/RequireAuth";

export default function BookingsPage() {
  return (
    <RequireAuth>
      <BookingsQueue />
    </RequireAuth>
  );
}
