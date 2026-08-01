import { describe, expect, it } from "vitest";
import {
  formatStartTime12h,
  MATCH_END_HOUR,
  MATCH_START_HOUR,
  parseStartTime12hInput,
  parseStartTimeInput,
  timeOptions,
} from "./match-start-time";

describe("timeOptions", () => {
  it("returns half-hour slots within the match window", () => {
    const options = timeOptions();
    expect(options[0]).toBe(`${String(MATCH_START_HOUR).padStart(2, "0")}:00`);
    expect(options.at(-1)).toBe(
      `${String(MATCH_END_HOUR).padStart(2, "0")}:00`,
    );
    expect(options).toContain("18:30");
    expect(options).not.toContain("21:30");
  });
});

describe("formatStartTime12h", () => {
  it("converts stored times for display", () => {
    expect(formatStartTime12h("18:00")).toEqual({
      clock: "6:00",
      meridiem: "PM",
    });
    expect(formatStartTime12h("09:30")).toEqual({
      clock: "9:30",
      meridiem: "AM",
    });
    expect(formatStartTime12h("12:00")).toEqual({
      clock: "12:00",
      meridiem: "PM",
    });
  });
});

describe("parseStartTime12hInput", () => {
  it("normalizes valid 12-hour times", () => {
    expect(parseStartTime12hInput("6:00", "PM")).toEqual({
      ok: true,
      time: "18:00",
    });
    expect(parseStartTime12hInput("9:30", "AM")).toEqual({
      ok: true,
      time: "09:30",
    });
    expect(parseStartTime12hInput("12:00", "PM")).toEqual({
      ok: true,
      time: "12:00",
    });
  });

  it("rejects invalid format, steps, and window", () => {
    expect(parseStartTime12hInput("6:15", "PM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("6:00", "AM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("13:00", "PM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("9:30", "PM")).toEqual({ ok: false });
  });
});

describe("parseStartTimeInput", () => {
  it("still accepts 24-hour input when used directly", () => {
    expect(parseStartTimeInput("18:00")).toEqual({ ok: true, time: "18:00" });
  });
});
