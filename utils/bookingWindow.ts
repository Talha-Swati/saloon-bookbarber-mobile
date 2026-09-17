// Phase 3C: the customer-facing booking window.
//
// Mirrors saloon-bookbarber-web/src/lib/salons/booking-window.ts exactly, the same way
// salonService.ts mirrors the web query layer — one product rule, not two that can
// drift apart.
//
// Customers may book today plus the next six calendar days — seven days inclusive.
// The rule is enforced server-side by customer_booking_window_days() and
// get_service_availability (019_booking_lifecycle.sql in the web repo); this constant
// only mirrors it so the UI never offers a date the server would refuse. Every other
// availability rule (past dates, lead time, closing days, capacity, each salon's own
// salon_booking_settings.booking_window_days) lives only there.
export const BOOKING_WINDOW_DAYS = 7;

// Local-calendar YYYY-MM-DD. Deliberately not `toISOString().slice(0, 10)`, which was
// the previous behaviour in app/booking.tsx: that converts to UTC first, so in
// Pakistan (UTC+5) every time before 5am local resolved to the previous calendar day
// and the customer was shown — and could pick — a date the server treats as past.
export function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type BookingDate = { value: string; label: string };

// today .. today+6, in local calendar days. `new Date(y, m, d + i)` rolls over month
// and year boundaries correctly, so no arithmetic on the date string is needed.
export function bookingWindowDates(now: Date = new Date()): BookingDate[] {
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {
      value: toDateValue(day),
      label:
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : day.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
    };
  });
}

export function isWithinBookingWindow(value: string, now: Date = new Date()): boolean {
  return bookingWindowDates(now).some((day) => day.value === value);
}

/** Friendly label for a YYYY-MM-DD value, e.g. "Today" or "Thu 24 Sep". */
export function bookingDateLabel(value: string, now: Date = new Date()): string {
  const match = bookingWindowDates(now).find((day) => day.value === value);
  if (match) return match.label;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
