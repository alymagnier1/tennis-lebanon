"use client";

import { useEffect, useMemo, useState } from "react";
import { listStaffClubs, type StaffClub } from "@tennis-lebanon/api";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export function useStaffClubs() {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [clubs, setClubs] = useState<StaffClub[]>([]);
  const [clubId, setClubId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await listStaffClubs(client);
        if (cancelled) return;
        setClubs(data);
        if (data[0]) {
          setClubId(data[0].club_id);
        }
      } catch {
        if (!cancelled) {
          setError("load_failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const activeClub = clubs.find((club) => club.club_id === clubId) ?? clubs[0] ?? null;
  const isAdmin = activeClub?.role === "admin";

  return {
    client,
    clubs,
    clubId,
    setClubId,
    activeClub,
    isAdmin,
    loading,
    error,
  };
}
