import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  formatDateLabel,
  formatDbTime,
  formatDuration,
  formatPkr,
  relativeDayLabel,
} from "@/utils/format";

/**
 * Regression cover for the timezone bug found in Phase 1.
 *
 * services/salonService.ts and services/professionalService.ts each carried a private
 * `timeLabel` with a DIFFERENT implementation. The customer-facing one parsed the ISO
 * string directly, so it printed the stored UTC time verbatim; the barber-facing one
 * went through `new Date()` and printed local time. The same booking therefore showed
 * two different times depending on who was looking at it.
 *
 * The two shapes that genuinely differ are the INPUT kinds, not the timezone handling:
 *   - bookings.start_time is timestamptz    -> formatClockTime, local
 *   - salon_hours.open_time is a bare `time` -> formatDbTime, literal
 * These tests pin that distinction so the two cannot silently converge again.
 */

describe("formatClockTime - timestamptz", () => {
  it("renders a timestamp in local time, not raw UTC", () => {
    const iso = "2026-09-14T05:00:00+00:00";
    const expected = new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const [time, meridiem] = expected.split(" ");
    const [hour, minute] = time.split(":");
    expect(formatClockTime(iso)).toBe(`${Number(hour)}:${minute} ${meridiem}`);
  });

  it("does NOT simply echo the hour embedded in the ISO string", () => {
    // The old buggy implementation returned "5:00 AM" here by string-slicing. That is
    // only correct if the device happens to sit at UTC+0, which Pakistan does not.
    const result = formatClockTime("2026-09-14T05:00:00+00:00");
    const offsetMinutes = new Date("2026-09-14T05:00:00+00:00").getTimezoneOffset();
    if (offsetMinutes !== 0) {
      expect(result).not.toBe("5:00 AM");
    }
  });

  it("renders midnight as 12 AM rather than 0 AM", () => {
    const midnight = new Date(2026, 0, 1, 0, 30).toISOString();
    expect(formatClockTime(midnight)).toBe("12:30 AM");
  });

  it("renders noon as 12 PM", () => {
    const noon = new Date(2026, 0, 1, 12, 5).toISOString();
    expect(formatClockTime(noon)).toBe("12:05 PM");
  });

  it("returns an empty string for junk rather than 'Invalid Date'", () => {
    expect(formatClockTime("not-a-timestamp")).toBe("");
    expect(formatClockTime("")).toBe("");
  });
});

describe("formatDbTime - bare `time` column", () => {
  it("reads the value literally, with no timezone shifting", () => {
    // salon_hours.open_time carries no date and no zone. Shifting it would be wrong:
    // "10:00:00" means the salon opens at ten, wherever the reader happens to be.
    expect(formatDbTime("10:00:00")).toBe("10:00 AM");
    expect(formatDbTime("20:00:00")).toBe("8:00 PM");
  });

  it("handles midnight and noon", () => {
    expect(formatDbTime("00:00:00")).toBe("12:00 AM");
    expect(formatDbTime("12:00:00")).toBe("12:00 PM");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(formatDbTime("closed")).toBe("closed");
    expect(formatDbTime("")).toBe("");
  });
});

describe("the two formatters stay distinct", () => {
  it("formatDbTime must not be fed a timestamp - that was the original bug", () => {
    // Feeding an ISO string to the literal parser is what produced the UTC-as-local
    // output. Asserting they disagree keeps anyone from "simplifying" them into one.
    const iso = "2026-09-14T05:00:00+00:00";
    const offsetMinutes = new Date(iso).getTimezoneOffset();
    if (offsetMinutes !== 0) {
      expect(formatDbTime("05:00:00")).not.toBe(formatClockTime(iso));
    }
  });
});

describe("formatPkr", () => {
  it("formats with separators", () => {
    expect(formatPkr(1200)).toBe("PKR 1,200");
  });

  it("treats null and undefined as zero", () => {
    expect(formatPkr(undefined as unknown as number)).toBe("PKR 0");
    expect(formatPkr(null as unknown as number)).toBe("PKR 0");
  });
});

describe("formatDateLabel", () => {
  it("includes weekday, day, month and year", () => {
    const label = formatDateLabel(new Date(2026, 8, 14).toISOString());
    expect(label).toMatch(/Sep/);
    expect(label).toMatch(/2026/);
  });

  it("returns the input when unparseable", () => {
    expect(formatDateLabel("nonsense")).toBe("nonsense");
  });
});

describe("relativeDayLabel", () => {
  // Fixed reference so the test does not change meaning at midnight.
  const now = new Date(2026, 8, 22, 14, 0, 0); // 22 Sep 2026, 2pm local

  it("says Today and Tomorrow rather than a date", () => {
    expect(relativeDayLabel(new Date(2026, 8, 22, 9, 0).toISOString(), now)).toBe("Today");
    expect(relativeDayLabel(new Date(2026, 8, 23, 9, 0).toISOString(), now)).toBe("Tomorrow");
  });

  it("compares calendar days, not elapsed hours", () => {
    // 9am tomorrow is 19 hours away, which is under a day. It is still "Tomorrow", and a
    // naive hours-based implementation would call it "Today".
    expect(relativeDayLabel(new Date(2026, 8, 23, 9, 0).toISOString(), now)).toBe("Tomorrow");
    // 11pm tonight is nine hours away and is still today.
    expect(relativeDayLabel(new Date(2026, 8, 22, 23, 0).toISOString(), now)).toBe("Today");
  });

  it("counts days inside the week either side", () => {
    expect(relativeDayLabel(new Date(2026, 8, 25, 9, 0).toISOString(), now)).toBe("In 3 days");
    expect(relativeDayLabel(new Date(2026, 8, 21, 9, 0).toISOString(), now)).toBe("Yesterday");
    expect(relativeDayLabel(new Date(2026, 8, 19, 9, 0).toISOString(), now)).toBe("3 days ago");
  });

  it("falls back to the full date beyond a week", () => {
    // Far enough away that "in 40 days" helps nobody plan.
    expect(relativeDayLabel(new Date(2026, 9, 31, 9, 0).toISOString(), now)).toContain("Oct");
  });

  it("returns an empty string for an unusable value rather than 'Invalid Date'", () => {
    expect(relativeDayLabel("", now)).toBe("");
    expect(relativeDayLabel("not a date", now)).toBe("");
  });
});

describe("formatDuration", () => {
  it("keeps minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("turns a multi-service visit into hours and minutes", () => {
    // A three-service visit is routinely this long, and "135 minutes" is a number the
    // customer has to do arithmetic on to find out whether it eats their afternoon.
    expect(formatDuration(135)).toBe("2 hr 15 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(120)).toBe("2 hr");
  });

  it("does not produce a negative or NaN duration", () => {
    expect(formatDuration(-10)).toBe("0 min");
    expect(formatDuration(Number.NaN)).toBe("0 min");
  });
});
