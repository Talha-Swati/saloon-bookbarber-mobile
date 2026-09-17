// Customer-facing copy for the stable error codes the booking RPCs raise.
//
// WHY THIS IS ITS OWN MODULE
//
// This map used to live at the bottom of services/salonService.ts, which imports
// services/supabase.ts, which imports react-native and AsyncStorage at module scope. That
// made the one piece of pure product logic in the file impossible to unit-test from a
// plain node runner - so nothing checked it, and it had quietly fallen six codes behind
// the web client's copy. Pulling it out costs one file and makes the whole thing
// testable; salonService.ts re-exports it, so no call site changes.
//
// WHAT THE CODES ARE
//
// Every customer-facing RPC signals failure by raising a SCREAMING_SNAKE code as the
// exception message (saloon-bookbarber-web/supabase/migrations 007, 015, 016, 019, 020).
// PostgREST wraps it, so the code arrives inside a longer string and is matched with
// `includes`, not equality - the same technique the web client uses.
//
// KEEP IN STEP WITH saloon-bookbarber-web/src/lib/salons/queries.ts's
// bookingErrorMessage. tests/contract/portal-parity.test.ts in the web repo fails the
// build if either client stops covering a code the other does.

type Rule = { code: string; message: string };

/**
 * Ordered because some codes are substrings of nothing, but order still documents
 * intent: the most specific situation a customer can be in comes first.
 */
const RULES: Rule[] = [
  // --- who you are -----------------------------------------------------------------
  {
    code: "AUTH_REQUIRED",
    message: "Please sign in to book this appointment.",
  },
  {
    code: "CUSTOMER_PROFILE_REQUIRED",
    message: "This account is not set up as a customer profile.",
  },
  {
    code: "CUSTOMER_CONTACT_REQUIRED",
    message: "Add your name and phone number before booking.",
  },

  // --- what you are trying to book ---------------------------------------------------
  {
    code: "SALON_NOT_BOOKABLE",
    message: "This salon is not accepting bookings right now.",
  },
  {
    code: "SERVICE_NOT_BOOKABLE",
    message: "This service is no longer available.",
  },
  {
    code: "AT_LEAST_ONE_SERVICE_REQUIRED",
    message: "Select at least one service to book.",
  },
  {
    code: "SERVICES_MUST_BELONG_TO_SAME_SALON",
    message: "All selected services must be from this salon.",
  },
  {
    code: "VISIT_DOES_NOT_FIT_TODAY",
    message:
      "This combination of services doesn’t fit before closing at that start time — try an earlier time or fewer services.",
  },

  // --- when ---------------------------------------------------------------------------
  {
    code: "SLOT_UNAVAILABLE",
    message: "That slot is no longer available. Please choose another time.",
  },
  {
    code: "SLOT_FULL",
    message: "That slot is no longer available. Please choose another time.",
  },
  {
    code: "BOOKING_TIME_IN_PAST",
    message: "That time has already passed — please choose another slot.",
  },

  // --- changing a booking you already have ---------------------------------------------
  {
    code: "BOOKING_NOT_FOUND",
    message: "That booking could not be found on your account.",
  },
  {
    code: "INVALID_STATUS_TRANSITION",
    message: "This booking can no longer be changed.",
  },
  {
    code: "BOOKING_NOT_RESCHEDULABLE",
    message: "Only an upcoming confirmed booking can be rescheduled.",
  },
  {
    code: "BOOKING_ALREADY_STARTED",
    message: "This appointment has already started and can no longer be moved.",
  },
  {
    code: "BOOKING_NOT_PAYABLE",
    message: "This booking is no longer open for payment.",
  },

  // --- this app's own preconditions ----------------------------------------------------
  // Not a server code: services/api.ts throws it when EXPO_PUBLIC_API_URL is unset, so
  // online payment has no backend to talk to in this build.
  {
    code: "API_NOT_CONFIGURED",
    message: "Online payment isn't set up in this build yet.",
  },
];

/** The raw text an error arrived as, whatever shape it arrived in. */
function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "");
}

/**
 * Customer-facing copy for a failed booking call.
 *
 * The fallback is deliberately generic. It used to be `return message`, which put the
 * raw Postgres/PostgREST text on a customer's phone for every code this map did not
 * know - and because it always rendered SOMETHING, the six missing codes looked like
 * working error handling right up until somebody read one of the messages.
 */
export function bookingErrorMessage(error: unknown): string {
  const message = rawMessage(error);

  for (const rule of RULES) {
    if (message.includes(rule.code)) return rule.message;
  }

  // Expired or missing session, as reported by supabase-js or the auth server rather
  // than by one of our own RPCs.
  if (/jwt|session|token/i.test(message)) return "Your session expired. Please sign in again.";

  // A phone on a train. Worth distinguishing, because "try again" is the right advice
  // here and the wrong advice for a slot that has genuinely gone.
  if (/network|fetch failed|offline|timeout/i.test(message))
    return "Unable to connect. Check your internet connection and try again.";

  return "Something went wrong. Please try again.";
}

/** The codes this map covers, for the parity suite and for anyone auditing coverage. */
export const HANDLED_BOOKING_ERROR_CODES = RULES.map((rule) => rule.code);
