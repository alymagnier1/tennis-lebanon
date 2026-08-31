import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installDeepLinkCapture,
  peekCapturedDeepLink,
  resetDeepLinkCaptureForTests,
} from "./deep-link-buffer";

function fakeLinking() {
  const handlers: ((event: { url: string }) => void)[] = [];
  return {
    linking: {
      addEventListener: (
        _type: "url",
        handler: (e: { url: string }) => void,
      ) => {
        handlers.push(handler);
        return { remove: vi.fn() };
      },
    },
    emit: (url: string) => handlers.forEach((h) => h({ url })),
    handlerCount: () => handlers.length,
  };
}

describe("deep link capture", () => {
  beforeEach(resetDeepLinkCaptureForTests);

  it("holds a link that arrives before any screen mounts", () => {
    const { linking, emit } = fakeLinking();
    installDeepLinkCapture(linking);

    emit("tennislebanon://auth/callback?code=abc");

    expect(peekCapturedDeepLink()).toBe(
      "tennislebanon://auth/callback?code=abc",
    );
  });

  it("is null before anything arrives", () => {
    const { linking } = fakeLinking();
    installDeepLinkCapture(linking);
    expect(peekCapturedDeepLink()).toBeNull();
  });

  it("installs only once", () => {
    const { linking, handlerCount } = fakeLinking();
    installDeepLinkCapture(linking);
    installDeepLinkCapture(linking);
    expect(handlerCount()).toBe(1);
  });

  it("keeps the newest link", () => {
    const { linking, emit } = fakeLinking();
    installDeepLinkCapture(linking);
    emit("tennislebanon://auth/callback?code=one");
    emit("tennislebanon://auth/callback?code=two");
    expect(peekCapturedDeepLink()).toContain("two");
  });
});
