"use client";

import { useEffect, useState } from "react";
import { isPlatformOperator } from "@tennis-lebanon/api";
import { getSupabaseBrowserClient } from "@/lib/supabase.client";

export function usePlatformOperator(): boolean {
  const [isOperator, setIsOperator] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const operator = await isPlatformOperator(getSupabaseBrowserClient());
        if (!cancelled) {
          setIsOperator(operator);
        }
      } catch {
        if (!cancelled) {
          setIsOperator(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return isOperator;
}
