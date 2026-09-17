import { describe, expect, it } from "vitest";
import { formatRating, formatReviewCount } from "@/utils/format";
import { bookingWindowDates, isWithinBookingWindow, toDateValue } from "@/utils/bookingWindow";

/**
 * How a salon presents itself in the app, and the date range it offers.
 *
 * Regression cover for a cluster of display bugs that shipped because `salons` has no
 * such column and the mapper's `?? fallback` hid it: `row.distance_km`,
 * `row.starting_price`, `row.featured`, `row.accent`, `row.is_open` and
 * `row.description` were all read from a table that has none of them, so each was
 * permanently undefined and the fallback beside it was what actually rendered. Nothing
 * threw, nothing logged, and the salon card showed "· 0 km" under every salon forever.
 *
 * The web repo's tests/contract/portal-parity.test.ts is what stops a phantom column
 * being reintroduced; these cover the formatting decisions that fixing them required.
 */

describe("formatRating", () => {
  it("rounds to one decimal, matching the website", () => {
    // The average is recomputed from the reviews rows on every request, so this really is
    // the shape it arrives in. Interpolated raw, it put sixteen digits on screen.
    expect(formatRating(4.333333333333333)).toBe("4.3");
    expect(formatRating(5)).toBe("5.0");
  });

  it("says nothing at all for a salon nobody has reviewed", () => {
    // The bug worth naming: rendering an unrated salon as "★ 0" tells a customer it was
    // rated, and rated badly. The website hides the figure entirely; so does this.
    expect(formatRating(null)).toBeNull();
    expect(formatRating(0)).toBeNull();
    expect(formatRating(undefined)).toBeNull();
  });

  it("does not render a broken number", () => {
    expect(formatRating(Number.NaN)).toBeNull();
    expect(formatRating(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("formatReviewCount", () => {
  it("pluralises", () => {
    // "1 reviews" was on the salon detail screen. Small, and exactly the kind of thing
    // that makes a product feel unfinished.
    expect(formatReviewCount(1)).toBe("1 review");
    expect(formatReviewCount(2)).toBe("2 reviews");
  });

  it("has words for none", () => {
    expect(formatReviewCount(0)).toBe("No reviews yet");
  });
});

describe("booking window", () => {
  // Mirrors saloon-bookbarber-web/tests/unit/booking-window.test.ts. The web repo's
  // parity suite asserts the two BOOKING_WINDOW_DAYS constants are equal; this asserts
  // the app's own arithmetic, which is the other half of "the same salon offers the same
  // dates on both clients".

  it("offers today plus the next six days", () => {
    const now = new Date(2026, 8, 17, 10, 0, 0); // 17 Sep 2026, local
    const dates = bookingWindowDates(now);
    expect(dates).toHaveLength(7);
    expect(dates[0].value).toBe("2026-09-17");
    expect(dates[0].label).toBe("Today");
    expect(dates[1].label).toBe("Tomorrow");
    expect(dates[6].value).toBe("2026-09-23");
  });

  it("rolls over a month boundary", () => {
    const dates = bookingWindowDates(new Date(2026, 8, 29, 10, 0, 0));
    expect(dates[6].value).toBe("2026-10-05");
  });

  it("uses the LOCAL calendar day, not the UTC one", () => {
    // The bug this replaced: toISOString().slice(0,10) converts to UTC first, so in
    // Pakistan (UTC+5) every time before 5am resolved to the previous calendar day and
    // the customer was offered - and could pick - a date the server treats as past.
    const beforeDawn = new Date(2026, 8, 17, 2, 30, 0);
    expect(toDateValue(beforeDawn)).toBe("2026-09-17");
  });

  it("refuses a date outside the window", () => {
    const now = new Date(2026, 8, 17, 10, 0, 0);
    expect(isWithinBookingWindow("2026-09-17", now)).toBe(true);
    expect(isWithinBookingWindow("2026-09-23", now)).toBe(true);
    expect(isWithinBookingWindow("2026-09-24", now)).toBe(false);
    expect(isWithinBookingWindow("2026-09-16", now)).toBe(false);
  });
});
