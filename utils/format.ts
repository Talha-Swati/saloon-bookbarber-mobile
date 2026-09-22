// Shared formatting helpers.
//
// These were previously two private `timeLabel` copies - one in salonService.ts, one
// in professionalService.ts - with DIFFERENT implementations, and that divergence was
// a live bug: salonService parsed the ISO string directly (`value.split("T")[1]`),
// which renders the stored UTC time verbatim, while professionalService went through
// `new Date()` and rendered local time. A booking at 2026-09-14T05:00:00+00:00 showed
// as "5:00 AM" to the customer and "10:00 AM" to the barber for the same appointment.
//
// The two formats genuinely needed are different *input shapes*, not different
// timezone behavior, so they are now two explicitly named functions:
//   - formatClockTime  for timestamptz values (bookings.start_time) -> local time
//   - formatDbTime     for bare `time` columns (salon_hours.open_time, "10:00:00"),
//                      which carry no date or zone and must be read literally.

function clockFace(hours: number, minutes: number): string {
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

/** For timestamptz values. Renders in the device's local timezone. */
export function formatClockTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  return clockFace(date.getHours(), date.getMinutes());
}

/** For bare Postgres `time` columns like "10:00:00" - no date, no zone, read literally. */
export function formatDbTime(value: string): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return value;
  return clockFace(h, m || 0);
}

/** For timestamptz values, e.g. "Sat, 14 Sep 2026". */
export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Currency, e.g. "PKR 1,200". Previously inlined at 12 call sites in two shapes. */
export function formatPkr(amount: number): string {
  return `PKR ${Number(amount ?? 0).toLocaleString()}`;
}

/**
 * A salon's star rating as it should appear, or null when there is nothing to show.
 *
 * `rating` is an average recomputed from the `reviews` rows on every request, so it is
 * routinely a value like 4.333333333333333. Interpolating it directly - which both the
 * salon card and the salon detail screen did - put all sixteen digits on screen, and
 * rendered a brand-new salon with no reviews at all as "★ 0", which reads as one star.
 *
 * One decimal place, matching the web directory's `salon.rating.toFixed(1)`, so the same
 * salon shows the same number on the website and in the app.
 */
export function formatRating(rating: number | null | undefined): string | null {
  if (rating === null || rating === undefined) return null;
  if (!Number.isFinite(rating) || rating <= 0) return null;
  return rating.toFixed(1);
}

/** "12 reviews" / "1 review" / "No reviews yet" - the count in words, pluralised. */
export function formatReviewCount(count: number): string {
  const n = Number(count ?? 0);
  if (n <= 0) return "No reviews yet";
  return `${n.toLocaleString()} review${n === 1 ? "" : "s"}`;
}

/**
 * How far away an appointment is, in the words a person would use.
 *
 * "Sat, 26 Sep 2026" is precise and answers nothing: to know whether that is tomorrow or
 * next week you have to look up today's date. This is the line that goes in front of the
 * date, not instead of it — both are shown, because "Tomorrow" alone is no use to
 * someone scanning a list of four appointments.
 *
 * Compared on local calendar days, not on elapsed hours: an appointment at 9am tomorrow
 * is "Tomorrow" whether it is now 8am or 11pm tonight.
 */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1 && days > -7) return `${Math.abs(days)} days ago`;
  return formatDateLabel(iso);
}

/**
 * Minutes as a person would say them: "45 min", "1 hr", "1 hr 30 min".
 *
 * A three-service visit is routinely 90 or 135 minutes, and "135 minutes" is a number
 * the customer has to do arithmetic on to find out whether it eats their afternoon.
 */
export function formatDuration(minutes: number): string {
  const parsed = Number(minutes);
  // Math.max(0, NaN) is NaN, so the clamp alone is not a guard. `duration` reaches this
  // from `Number(row.duration_minutes_snapshot ?? service?.duration_minutes)`, which is
  // NaN for any booking whose snapshot is missing or non-numeric — and "NaN hr" on a
  // booking card is worse than saying nothing.
  const total = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
