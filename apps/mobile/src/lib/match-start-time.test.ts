import { describe, expect, it } from "vitest";
import { formatStartTime12h, parseStartTime12hInput } from "./match-start-time";

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

  it("keeps minutes that are not on the half hour", () => {
    expect(formatStartTime12h("15:10")).toEqual({
      clock: "3:10",
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

  it("accepts any minute inside the window", () => {
    // The half-hour rule belonged to a picker the UI no longer renders, and
    // rejecting these reported them as outside 7:00 AM to 9:00 PM, which they
    // are not. A club booked over WhatsApp can hand you 3:10.
    expect(parseStartTime12hInput("3:10", "PM")).toEqual({
      ok: true,
      time: "15:10",
    });
    expect(parseStartTime12hInput("6:15", "PM")).toEqual({
      ok: true,
      time: "18:15",
    });
    expect(parseStartTime12hInput("7:45", "AM")).toEqual({
      ok: true,
      time: "07:45",
    });
  });

  it("still rejects times outside the window", () => {
    expect(parseStartTime12hInput("6:00", "AM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("9:30", "PM")).toEqual({ ok: false });
    // 9:00 PM is the last minute of the window, 9:01 PM is past it.
    expect(parseStartTime12hInput("9:00", "PM")).toEqual({
      ok: true,
      time: "21:00",
    });
    expect(parseStartTime12hInput("9:01", "PM")).toEqual({ ok: false });
  });

  it("still rejects malformed input", () => {
    expect(parseStartTime12hInput("13:00", "PM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("6", "PM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("6:0", "PM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("6:60", "PM")).toEqual({ ok: false });
    expect(parseStartTime12hInput("", "PM")).toEqual({ ok: false });
  });
});
