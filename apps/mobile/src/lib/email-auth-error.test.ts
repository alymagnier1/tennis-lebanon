import { describe, expect, it } from "vitest";
import { emailAuthFailure } from "./email-auth-error";

describe("emailAuthFailure", () => {
  it("classifies the common Auth messages", () => {
    expect(emailAuthFailure({ message: "Invalid login credentials" })).toBe(
      "invalid",
    );
    expect(emailAuthFailure({ message: "Email not confirmed" })).toBe(
      "unconfirmed",
    );
    expect(emailAuthFailure({ message: "User already registered" })).toBe(
      "exists",
    );
    expect(
      emailAuthFailure({ message: "Password should be at least 8 characters" }),
    ).toBe("weak");
    expect(emailAuthFailure({ message: "network timeout" })).toBe("generic");
    expect(emailAuthFailure(null)).toBe("generic");
  });
});
