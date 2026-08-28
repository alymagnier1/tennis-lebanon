import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAvailabilityLiquidity } from "@tennis-lebanon/api";
import {
  pickUpcomingBlocks,
  toLiquidityRows,
} from "../lib/availability-liquidity";
import { supabase } from "../lib/supabase";

export const HOME_LIQUIDITY_HORIZON_DAYS = 7;
export const HOME_LIQUIDITY_OFFER_LIMIT = 3;

export function useHomeLiquidityOffers() {
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const query = useQuery({
    queryKey: ["availability-liquidity"],
    queryFn: () =>
      getAvailabilityLiquidity(supabase, HOME_LIQUIDITY_HORIZON_DAYS),
    staleTime: 60_000,
  });

  const rows = useMemo(
    () => toLiquidityRows(query.data ?? [], nowIso),
    [query.data, nowIso],
  );

  const offers = useMemo(
    () => pickUpcomingBlocks(rows, HOME_LIQUIDITY_OFFER_LIMIT),
    [rows],
  );

  return { query, rows, offers, nowIso };
}
