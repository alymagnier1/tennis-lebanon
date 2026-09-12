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

describe("emailAuthFailure by error code", () => {
  it("classifies from the stable code", () => {
    expect(emailAuthFailure({ code: "invalid_credentials" })).toBe("invalid");
    expect(emailAuthFailure({ code: "email_not_confirmed" })).toBe(
      "unconfirmed",
    );
    expect(emailAuthFailure({ code: "user_already_exists" })).toBe("exists");
    expect(emailAuthFailure({ code: "email_exists" })).toBe("exists");
    expect(emailAuthFailure({ code: "weak_password" })).toBe("weak");
  });

  /**
   * The point of the change: a reworded or localized message must not be able
   * to downgrade a classified error into the useless generic case.
   */
  it("prefers the code over unrecognisable prose", () => {
    expect(
      emailAuthFailure({
        code: "invalid_credentials",
        message: "Identifiants de connexion invalides",
      }),
    ).toBe("invalid");
  });

  it("still reads prose when no code is present", () => {
    expect(emailAuthFailure({ message: "Invalid login credentials" })).toBe(
      "invalid",
    );
  });

  it("does not invent a classification for an unknown code", () => {
    expect(emailAuthFailure({ code: "some_future_code" })).toBe("generic");
  });
});
