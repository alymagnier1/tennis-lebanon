import { useQuery } from "@tanstack/react-query";
import { listClubsDirectory } from "@tennis-lebanon/api";
import { supabase } from "../lib/supabase";

export function useClubsDirectory(zoneIds?: string[]) {
  return useQuery({
    queryKey: ["clubs-directory", zoneIds ?? "all"],
    queryFn: () => listClubsDirectory(supabase, zoneIds),
  });
}
