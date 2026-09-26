export type NetworkSnapshot = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

/**
 * What the OS alone can say about a network event.
 *
 * `isInternetReachable` is Android's VALIDATED capability: whether its own
 * check against Google's servers passed. It is `false` for a moment after
 * every reconnect, can stay `false` on networks where that check fails while
 * everything else works (seen on the emulator, 2026-09-26), and also drops
 * when a weak mobile connection stalls. So `false` there means "unverified",
 * not "offline" -- only a missing connection is offline for certain. Unknown
 * values (`null`/`undefined`, other platforms) count as online.
 */
export function classifyNetwork(
  state: NetworkSnapshot,
): "online" | "offline" | "unverified" {
  if (state.isConnected === false) return "offline";
  if (state.isInternetReachable === false) return "unverified";
  return "online";
}

export type OnlineBridgeDeps = {
  subscribe: (listener: (state: NetworkSnapshot) => void) => () => void;
  /** Resolves true when our backend answered; never rejects. */
  probe: () => Promise<boolean>;
  setOnline: (online: boolean) => void;
  /**
   * Called when the app returns to the foreground. Paired with `readState`,
   * it re-checks the network then; see `createOnlineBridge`.
   */
  subscribeForeground?: (onForeground: () => void) => () => void;
  /** A fresh reading of the network, for the foreground re-check. */
  readState?: () => Promise<NetworkSnapshot>;
  /** How often to ask again while the network stays unverified. */
  retryMs?: number;
  schedule?: (run: () => void, ms: number) => () => void;
};

/**
 * Feeds React Query's `onlineManager` from network events.
 *
 * An unverified network is settled by asking our own backend instead of
 * trusting Android's check: a stalled mobile connection fails the probe and
 * pauses queries as before, while a network whose only fault is Google's
 * check stops being reported offline. The previous answer stands while a
 * probe is in flight, so a reconnect does not flash the offline banner.
 *
 * Events alone are not enough. To save battery Android blocks a background
 * app's network access; `expo-network` then reports no connection, and when
 * the block lifts it reports nothing. A phone that went "offline" in the
 * background stayed offline in the foreground on a working network until the
 * app restarted (2026-09-26, 16 minutes). So the network is read again on
 * every return to the foreground, and anything short of online is settled by
 * the probe -- the reading can still carry the block for a moment.
 */
export function createOnlineBridge({
  subscribe,
  probe,
  setOnline,
  subscribeForeground,
  readState,
  retryMs = 15_000,
  schedule = (run, ms) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
}: OnlineBridgeDeps): () => void {
  let generation = 0;
  let cancelRetry: (() => void) | null = null;

  const stopRetry = () => {
    cancelRetry?.();
    cancelRetry = null;
  };

  const verify = (current: number) => {
    void probe().then((reachable) => {
      // A newer network event has taken over; its answer wins.
      if (current !== generation) return;
      setOnline(reachable);
      if (!reachable) {
        cancelRetry = schedule(() => verify(current), retryMs);
      }
    });
  };

  const settle = (state: NetworkSnapshot, onReturn: boolean) => {
    generation += 1;
    stopRetry();
    const kind = classifyNetwork(state);
    if (kind === "online") {
      setOnline(true);
    } else if (kind === "unverified" || onReturn) {
      verify(generation);
    } else {
      setOnline(false);
    }
  };

  const unsubscribe = subscribe((state) => settle(state, false));

  const unsubscribeForeground =
    subscribeForeground && readState
      ? subscribeForeground(() => {
          const requested = generation;
          void readState().then(
            (state) => {
              // A network event arrived meanwhile; it is newer than this reading.
              if (requested !== generation) return;
              settle(state, true);
            },
            () => {
              if (requested !== generation) return;
              settle({ isInternetReachable: false }, true);
            },
          );
        })
      : () => undefined;

  return () => {
    generation += 1;
    stopRetry();
    unsubscribe();
    unsubscribeForeground();
  };
}

/**
 * Asks the backend's unauthenticated health endpoint whether it can be
 * reached. Sends only the public API key; never throws.
 */
export function createBackendProbe(options: {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): () => Promise<boolean> {
  const { baseUrl, apiKey, timeoutMs = 5_000, fetchImpl = fetch } = options;
  const url = `${baseUrl.replace(/\/+$/, "")}/auth/v1/health`;
  return async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { apikey: apiKey },
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
