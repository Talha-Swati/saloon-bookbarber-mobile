/**
 * TEST-MODE payment simulator.
 *
 * ================== READ THIS BEFORE SHIPPING ==================
 * NOTHING HERE TOUCHES MONEY. There is no Easypaisa API call, no merchant credential,
 * no network request of any kind. It waits, invents a reference number, and returns
 * success. It exists so the booking flow has the shape it will have in production —
 * a mandatory payment step between "review" and "booked" — while the real gateway is
 * not yet attached.
 *
 * Every screen that uses this MUST say on screen that it is test mode. A payment UI
 * that looks real and takes nothing is the single most dangerous kind of placeholder:
 * a customer who believes they paid will turn up expecting a paid appointment.
 * ==============================================================
 *
 * WHAT REPLACING THIS LOOKS LIKE
 *
 * The real flow cannot be "swap the function body". A client must never be the thing
 * that decides a payment succeeded — this module returning `{ status: "paid" }` from
 * the device is exactly the shape that must NOT survive. The real path is already
 * sketched in the backend:
 *
 *   1. initialize_booking_payment (020_booking_payment_foundation.sql, not yet applied)
 *      creates the payments row server-side, with the amount derived from the booking's
 *      own price snapshot. There is deliberately no amount argument.
 *   2. /api/payments/initiate on the web backend holds the merchant credentials and
 *      returns a redirect; services/salonService.ts#startDepositPayment already calls it.
 *   3. Easypaisa calls back server-to-server, and only that callback may move a payment
 *      to 'paid'. No client-callable function in the schema can.
 *
 * So this module is scaffolding for the UI, and is deleted rather than adapted.
 */

/** Always true in this build. Screens key their test-mode banner off this. */
export const PAYMENT_TEST_MODE = true;

export type DummyPaymentMethod = "easypaisa";

export type DummyPaymentResult = {
  reference: string;
  method: DummyPaymentMethod;
  /** Masked for display — the full number is never stored or sent anywhere. */
  accountMasked: string;
  amount: number;
  paidAt: string;
};

/**
 * Pakistani mobile numbers, the way people actually type them: 03001234567,
 * 0300-1234567, +92 300 1234567, 92 300 1234567.
 *
 * Returns the 11-digit local form (03XXXXXXXXX) or null. Validating this properly even
 * in test mode is worth it: it is the one field whose rules do not change when the real
 * gateway is attached, so getting it right now means one less thing to revisit.
 */
export function normalizeMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("92")
    ? `0${digits.slice(2)}`
    : digits.startsWith("0")
      ? digits
      : digits.length === 10
        ? `0${digits}`
        : digits;
  return /^03\d{9}$/.test(local) ? local : null;
}

export const maskMobile = (local: string) => `${local.slice(0, 4)}*****${local.slice(-2)}`;

/** EP-TEST- is in every reference on purpose: it can never be mistaken for a real one. */
function testReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `EP-TEST-${suffix}`;
}

export class DummyPaymentError extends Error {}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Pretends to charge the account. Rejects on bad input only — there is no simulated
 * decline, because a fake failure the customer cannot resolve is worse than no failure.
 */
export async function runDummyEasypaisaPayment(input: {
  mobile: string;
  pin: string;
  amount: number;
}): Promise<DummyPaymentResult> {
  const local = normalizeMobile(input.mobile);
  if (!local) {
    throw new DummyPaymentError("Enter a valid mobile number, for example 0300 1234567.");
  }
  if (!/^\d{5}$/.test(input.pin.trim())) {
    throw new DummyPaymentError("Enter your 5-digit Easypaisa PIN.");
  }
  if (!(input.amount > 0)) {
    throw new DummyPaymentError("There is nothing to pay for this booking.");
  }

  // Long enough to read as a real authorisation round trip rather than an instant
  // no-op, short enough not to feel broken.
  await wait(1600);

  return {
    reference: testReference(),
    method: "easypaisa",
    accountMasked: maskMobile(local),
    amount: input.amount,
    paidAt: new Date().toISOString(),
  };
}
