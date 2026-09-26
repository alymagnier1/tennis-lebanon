import { describe, expect, it, vi } from "vitest";
import {
  classifyNetwork,
  createBackendProbe,
  createOnlineBridge,
  type NetworkSnapshot,
} from "./connectivity";

function harness(probeResults: boolean[]) {
  let emit: (state: NetworkSnapshot) => void = () => undefined;
  const pending: (() => void)[] = [];
  const setOnline = vi.fn();
  const probe = vi.fn(async () => probeResults.shift() ?? false);
  const stop = createOnlineBridge({
    subscribe: (listener) => {
      emit = listener;
      return () => undefined;
    },
    probe,
    setOnline,
    schedule: (run) => {
      pending.push(run);
      return () => {
        const index = pending.indexOf(run);
        if (index >= 0) pending.splice(index, 1);
      };
    },
  });
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    emit: (s: NetworkSnapshot) => emit(s),
    setOnline,
    probe,
    pending,
    flush,
    stop,
  };
}

describe("classifyNetwork", () => {
  it("is offline only when there is no connection", () => {
    expect(
      classifyNetwork({ isConnected: false, isInternetReachable: false }),
    ).toBe("offline");
  });

  it("calls a connected network that failed Android's check unverified, not offline", () => {
    expect(
      classifyNetwork({ isConnected: true, isInternetReachable: false }),
    ).toBe("unverified");
  });

  it("treats unknown values as online", () => {
    expect(
      classifyNetwork({ isConnected: true, isInternetReachable: true }),
    ).toBe("online");
    expect(
      classifyNetwork({ isConnected: true, isInternetReachable: null }),
    ).toBe("online");
    expect(classifyNetwork({})).toBe("online");
  });
});

describe("createOnlineBridge", () => {
  it("stays online when Android's check fails but the backend answers (emulator case)", async () => {
    const h = harness([true]);

    h.emit({ isConnected: true, isInternetReachable: false });
    await h.flush();

    expect(h.probe).toHaveBeenCalledOnce();
    expect(h.setOnline).toHaveBeenCalledWith(true);
    expect(h.setOnline).not.toHaveBeenCalledWith(false);
  });

  it("goes offline when a stalled connection cannot reach the backend, and retries", async () => {
    const h = harness([false, true]);

    h.emit({ isConnected: true, isInternetReachable: false });
    await h.flush();
    expect(h.setOnline).toHaveBeenLastCalledWith(false);
    expect(h.pending).toHaveLength(1);

    h.pending.shift()!();
    await h.flush();
    expect(h.probe).toHaveBeenCalledTimes(2);
    expect(h.setOnline).toHaveBeenLastCalledWith(true);
  });

  it("goes offline at once when the connection is lost, without probing", () => {
    const h = harness([]);

    h.emit({ isConnected: false, isInternetReachable: false });

    expect(h.setOnline).toHaveBeenCalledWith(false);
    expect(h.probe).not.toHaveBeenCalled();
  });

  it("lets a newer network event overrule a slower probe", async () => {
    let resolveProbe: (value: boolean) => void = () => undefined;
    const setOnline = vi.fn();
    let emit: (state: NetworkSnapshot) => void = () => undefined;
    createOnlineBridge({
      subscribe: (listener) => {
        emit = listener;
        return () => undefined;
      },
      probe: () => new Promise((resolve) => (resolveProbe = resolve)),
      setOnline,
      schedule: () => () => undefined,
    });

    emit({ isConnected: true, isInternetReachable: false });
    emit({ isConnected: true, isInternetReachable: true });
    resolveProbe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setOnline.mock.calls).toEqual([[true]]);
  });

  it("stops retrying once the network is validated", async () => {
    const h = harness([false]);

    h.emit({ isConnected: true, isInternetReachable: false });
    await h.flush();
    expect(h.pending).toHaveLength(1);

    h.emit({ isConnected: true, isInternetReachable: true });

    expect(h.pending).toHaveLength(0);
    expect(h.setOnline).toHaveBeenLastCalledWith(true);
  });
});

describe("createBackendProbe", () => {
  it("asks the health endpoint with the public key only", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const probe = createBackendProbe({
      baseUrl: "https://example.supabase.co/",
      apiKey: "sb_publishable_test",
      fetchImpl,
    });

    await expect(probe()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/health",
      expect.objectContaining({ headers: { apikey: "sb_publishable_test" } }),
    );
  });

  it("answers false instead of throwing when the request fails", async () => {
    const probe = createBackendProbe({
      baseUrl: "https://example.supabase.co",
      apiKey: "k",
      fetchImpl: vi.fn(async () => {
        throw new TypeError("Network request failed");
      }),
    });

    await expect(probe()).resolves.toBe(false);
  });

  it("answers false for an error status", async () => {
    const probe = createBackendProbe({
      baseUrl: "https://example.supabase.co",
      apiKey: "k",
      fetchImpl: vi.fn(async () => new Response("", { status: 503 })),
    });

    await expect(probe()).resolves.toBe(false);
  });
});

describe("createOnlineBridge on return to the foreground", () => {
  function foregroundHarness(options: {
    reading: () => Promise<NetworkSnapshot>;
    probeResults?: boolean[];
  }) {
    let emit: (state: NetworkSnapshot) => void = () => undefined;
    let foreground: () => void = () => undefined;
    let foregroundListening = false;
    const pending: (() => void)[] = [];
    const results = [...(options.probeResults ?? [])];
    const setOnline = vi.fn();
    const probe = vi.fn(async () => results.shift() ?? false);
    const stop = createOnlineBridge({
      subscribe: (listener) => {
        emit = listener;
        return () => undefined;
      },
      subscribeForeground: (onForeground) => {
        foreground = onForeground;
        foregroundListening = true;
        return () => {
          foregroundListening = false;
        };
      },
      readState: options.reading,
      probe,
      setOnline,
      schedule: (run) => {
        pending.push(run);
        return () => undefined;
      },
    });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    return {
      emit: (s: NetworkSnapshot) => emit(s),
      foreground: () => foreground(),
      listening: () => foregroundListening,
      setOnline,
      probe,
      pending,
      flush,
      stop,
    };
  }

  it("clears a stale offline left from the background (the founder's phone, 2026-09-26)", async () => {
    const h = foregroundHarness({
      reading: async () => ({ isConnected: true, isInternetReachable: true }),
    });
    h.emit({ isConnected: false, isInternetReachable: false });
    expect(h.setOnline).toHaveBeenLastCalledWith(false);

    h.foreground();
    await h.flush();

    expect(h.setOnline).toHaveBeenLastCalledWith(true);
    expect(h.probe).not.toHaveBeenCalled();
  });

  it("settles a reading that still says no connection with the probe", async () => {
    const h = foregroundHarness({
      reading: async () => ({ isConnected: false, isInternetReachable: false }),
      probeResults: [true],
    });
    h.emit({ isConnected: false, isInternetReachable: false });

    h.foreground();
    await h.flush();
    await h.flush();

    expect(h.probe).toHaveBeenCalledOnce();
    expect(h.setOnline).toHaveBeenLastCalledWith(true);
  });

  it("stays offline, and keeps asking, when the probe fails too", async () => {
    const h = foregroundHarness({
      reading: async () => ({ isConnected: false, isInternetReachable: false }),
      probeResults: [false],
    });

    h.foreground();
    await h.flush();
    await h.flush();

    expect(h.setOnline).toHaveBeenLastCalledWith(false);
    expect(h.pending).toHaveLength(1);
  });

  it("lets a network event that lands during the re-read win", async () => {
    let resolveReading: (state: NetworkSnapshot) => void = () => undefined;
    const h = foregroundHarness({
      reading: () => new Promise((resolve) => (resolveReading = resolve)),
    });

    h.foreground();
    h.emit({ isConnected: true, isInternetReachable: true });
    resolveReading({ isConnected: false, isInternetReachable: false });
    await h.flush();

    expect(h.setOnline.mock.calls).toEqual([[true]]);
    expect(h.probe).not.toHaveBeenCalled();
  });

  it("falls back to the probe when the network cannot be read", async () => {
    const h = foregroundHarness({
      reading: async () => {
        throw new Error("native module unavailable");
      },
      probeResults: [true],
    });

    h.foreground();
    await h.flush();
    await h.flush();

    expect(h.probe).toHaveBeenCalledOnce();
    expect(h.setOnline).toHaveBeenLastCalledWith(true);
  });

  it("stops listening for the foreground when the bridge stops", () => {
    const h = foregroundHarness({ reading: async () => ({}) });

    h.stop();

    expect(h.listening()).toBe(false);
  });
});
