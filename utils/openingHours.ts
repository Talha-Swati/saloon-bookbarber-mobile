import type { DaySchedule } from "@/types";
import { formatDbTime } from "@/utils/format";

/**
 * Turning `salon_hours` rows into the week a customer reads.
 *
 * Kept out of services/salonService.ts on purpose: that module creates the Supabase
 * client at import time, so anything living in it cannot be unit tested without a
 * server. This is pure — rows in, display rows out — and the bug it exists to stop is
 * worth a test.
 *
 * THE BUG. `salon_hours.day_of_week` is a Postgres `dow` integer, 0 = Sunday, constrained
 * 0..6 (001_core_foundation.sql). The mapper this replaces interpolated that integer
 * straight into the text it showed customers and joined all seven days with a middle
 * dot, so a salon's opening hours rendered as:
 *
 *     0: 10:00 AM–9:00 PM · 1: 10:00 AM–9:00 PM · 2: …
 *
 * Seven unlabelled numbers in one run-on line, on the screen where somebody decides
 * whether a salon is open on the day they want to go.
 */

/** Index is the `dow` value, so DAY_NAMES[0] is Sunday, exactly as Postgres numbers it. */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Monday first.
 *
 * A week of opening hours is read as a working week; putting Sunday at the top — which
 * is what ordering by the raw `dow` integer does — starts the list on the weekend.
 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** A `salon_hours` row as PostgREST hands it over: every field still unknown. */
type HoursRow = Record<string, unknown>;

export function scheduleFrom(hours: HoursRow[]): DaySchedule[] {
  return hours
    .map((row): DaySchedule => {
      const dayOfWeek = Number(row.day_of_week);
      const closed = row.is_closed === true;
      return {
        dayOfWeek,
        // A value outside 0..6 should never exist — there is a check constraint on the
        // column — but naming it is better than rendering `undefined` if one ever does.
        day: DAY_NAMES[dayOfWeek] ?? `Day ${dayOfWeek}`,
        closed,
        text: closed
          ? "Closed"
          : `${formatDbTime(String(row.open_time ?? ""))} – ${formatDbTime(
              String(row.close_time ?? ""),
            )}`,
      };
    })
    .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek));
}
