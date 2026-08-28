import { describe, expect, it } from "vitest";
import { PLAYER_NOTE_MAX, sanitizePlayerNote } from "./invites";

describe("sanitizePlayerNote", () => {
  it("returns null for empty or whitespace", () => {
    expect(sanitizePlayerNote(null)).toBeNull();
    expect(sanitizePlayerNote(undefined)).toBeNull();
    expect(sanitizePlayerNote("")).toBeNull();
    expect(sanitizePlayerNote("   ")).toBeNull();
  });

  it("trims and collapses whitespace", () => {
    expect(sanitizePlayerNote("  Fancy a hit  ")).toBe("Fancy a hit");
    expect(sanitizePlayerNote("hi\n\nthere")).toBe("hi there");
  });

  it("strips URL-shaped tokens", () => {
    expect(sanitizePlayerNote("Ping me https://wa.me/961 and play")).toBe(
      "Ping me and play",
    );
    expect(sanitizePlayerNote("see www.example.com/x please")).toBe(
      "see please",
    );
  });

  it("caps length at PLAYER_NOTE_MAX", () => {
    const long = "a".repeat(PLAYER_NOTE_MAX + 20);
    expect(sanitizePlayerNote(long)?.length).toBe(PLAYER_NOTE_MAX);
  });
});
