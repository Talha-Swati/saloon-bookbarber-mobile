import { describe, expect, it } from "vitest";
import {
  HANDLED_BOOKING_ERROR_CODES,
  bookingErrorMessage,
} from "@/utils/bookingErrors";

/**
 * Customer-facing copy for booking failures.
 *
 * These were unreachable by any test until the map moved out of services/salonService.ts
 * (which imports react-native, so a node runner cannot load it). While it was
 * unreachable it drifted six codes behind the web client's copy, and every one of those
 * six fell through to `return message` - so a customer whose account had no profiles row
 * was shown the raw PostgREST text for CUSTOMER_PROFILE_REQUIRED on their phone.
 *
 * The shapes below are what PostgREST actually delivers: the code arrives embedded in a
 * longer string, not on its own, which is why every rule matches with `includes`.
 */

/** What supabase-js hands back for a raised exception, near enough. */
const postgrestError = (code: string) => ({
  message: `${code}`,
  details: null,
  hint: null,
  code: "P0001",
});

describe("bookingErrorMessage", () => {
  it("never returns the raw server text for a code it knows", () => {
    for (const code of HANDLED_BOOKING_ERROR_CODES) {
      const copy = bookingErrorMessage(postgrestError(code));
      expect(copy, `${code} was passed straight through`).not.toContain(code);
      expect(copy.length, `${code} produced empty copy`).toBeGreaterThan(10);
    }
  });

  it("finds the code inside the longer string PostgREST really sends", () => {
    // The live shape, taken from a real failure: the raised message is wrapped in
    // Postgres' own framing before it reaches the client.
    const wrapped = new Error(
      'failed to execute: ERROR: CUSTOMER_CONTACT_REQUIRED (SQLSTATE P0001)',
    );
    expect(bookingErrorMessage(wrapped)).toBe(
      "Add your name and phone number before booking.",
    );
  });

  it("covers the six codes that used to leak raw database text", () => {
    // Regression cover, named explicitly so the reason they matter is not lost.
    const cases: [string, RegExp][] = [
      ["AUTH_REQUIRED", /sign in/i],
      ["CUSTOMER_PROFILE_REQUIRED", /customer profile/i],
      ["CUSTOMER_CONTACT_REQUIRED", /name and phone/i],
      ["SALON_NOT_BOOKABLE", /not accepting bookings/i],
      ["SERVICE_NOT_BOOKABLE", /no longer available/i],
      ["BOOKING_TIME_IN_PAST", /already passed/i],
    ];
    for (const [code, expected] of cases) {
      expect(bookingErrorMessage(postgrestError(code)), code).toMatch(expected);
    }
  });

  it("does not put a raw error on the screen for a code it has never seen", () => {
    // The whole class of bug: an unmapped code must degrade to plain words, not to the
    // database's own vocabulary. A new server code shipped tomorrow must be safe today.
    const copy = bookingErrorMessage(postgrestError("SOME_FUTURE_SERVER_CODE"));
    expect(copy).not.toContain("SOME_FUTURE_SERVER_CODE");
    expect(copy).toBe("Something went wrong. Please try again.");
  });

  it("tells an expired session apart from a lost connection", () => {
    // Different advice: one means sign in again, the other means try again. Collapsing
    // them into one generic message is how a customer ends up signing out and back in
    // because their train went through a tunnel.
    expect(bookingErrorMessage(new Error("JWT expired"))).toMatch(/sign in again/i);
    expect(bookingErrorMessage(new TypeError("fetch failed"))).toMatch(/connection/i);
  });

  it("survives the shapes an error can arrive in", () => {
    for (const input of [null, undefined, "", 42, {}, { message: null }]) {
      expect(() => bookingErrorMessage(input)).not.toThrow();
      expect(bookingErrorMessage(input).length).toBeGreaterThan(10);
    }
  });

  it("prefers the specific reason when one code contains another's words", () => {
    // SLOT_UNAVAILABLE and SLOT_FULL mean the same thing to a customer and share copy;
    // BOOKING_NOT_FOUND and BOOKING_NOT_PAYABLE do not, and must not collapse.
    expect(bookingErrorMessage(postgrestError("BOOKING_NOT_PAYABLE"))).toMatch(/open for payment/i);
    expect(bookingErrorMessage(postgrestError("BOOKING_NOT_FOUND"))).toMatch(/could not be found/i);
  });
});
