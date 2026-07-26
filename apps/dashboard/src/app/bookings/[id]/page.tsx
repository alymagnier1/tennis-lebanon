import { BookingDetailPanel } from "@/components/BookingDetailPanel";
import { RequireAuth } from "@/components/RequireAuth";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <RequireAuth>
      <BookingDetailPanel bookingId={id} />
    </RequireAuth>
  );
}
