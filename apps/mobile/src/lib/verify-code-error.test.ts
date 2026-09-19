import { describe, expect, it } from "vitest";
import { resendCodeFailure, verifyCodeFailure } from "./verify-code-error";

describe("verifyCodeFailure", () => {
  it("reads the stable code rather than the prose", () => {
    expect(
      verifyCodeFailure({ code: "otp_expired", message: "anything" }),
    ).toBe("invalid");
    expect(verifyCodeFailure({ code: "over_request_rate_limit" })).toBe(
      "rateLimited",
    );
  });

  // Supabase answers a wrong code and an expired code identically, on purpose,
  // so a caller cannot probe which codes exist. One key has to cover both.
  it("treats a wrong code and an expired code as the same failure", () => {
    expect(
      verifyCodeFailure({ message: "Token has expired or is invalid" }),
    ).toBe("invalid");
  });

  it("falls back to prose when no code arrives", () => {
    expect(verifyCodeFailure({ message: "Email rate limit exceeded" })).toBe(
      "rateLimited",
    );
  });

  it("stays generic for anything it does not recognise", () => {
    expect(verifyCodeFailure({ message: "network request failed" })).toBe(
      "generic",
    );
    expect(verifyCodeFailure(null)).toBe("generic");
    expect(verifyCodeFailure("not an error")).toBe("generic");
  });
});

describe("resendCodeFailure", () => {
  it("names the rate limit, which is the one a player hits routinely", () => {
    expect(resendCodeFailure({ code: "over_email_send_rate_limit" })).toBe(
      "rateLimited",
    );
    // Supabase phrases the send gap as "For security purposes, you can only
    // request this after N seconds" and sends it without a code.
    expect(
      resendCodeFailure({
        message: "For security purposes, you can only request this after 41s",
      }),
    ).toBe("rateLimited");
  });

  it("stays generic otherwise", () => {
    expect(resendCodeFailure({ message: "boom" })).toBe("generic");
    expect(resendCodeFailure(null)).toBe("generic");
  });
});
