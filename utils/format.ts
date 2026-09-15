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
