import { describe, expect, it } from "vitest";
import { scheduleFrom } from "@/utils/openingHours";

/**
 * Regression cover for opening hours being shown to customers as raw integers.
 *
 * `salon_hours.day_of_week` is a Postgres `dow` value — 0 = Sunday — and the mapper it
 * replaced interpolated it straight into the text on the salon screen, so a salon
 * advertised itself as open on "0", "1" and "2". The column has a 0..6 check constraint
 * and no name anywhere, so nothing but this mapping stands between the database and the
 * customer.
 */

const row = (day: number, open = "10:00:00", close = "21:00:00", closed = false) => ({
  day_of_week: day,
  open_time: open,
  close_time: close,
  is_closed: closed,
});

describe("scheduleFrom", () => {
  it("names the day instead of printing the dow integer", () => {
    const [sunday] = scheduleFrom([row(0)]);
    expect(sunday.day).toBe("Sunday");
    expect(sunday.text).toBe("10:00 AM – 9:00 PM");
  });

  it("maps every dow value to the day Postgres means by it", () => {
    const days = scheduleFrom([0, 1, 2, 3, 4, 5, 6].map((d) => row(d)));
    // Returned Monday-first, so the working week reads top to bottom and the weekend is
    // where a person expects to find it.
    expect(days.map((d) => d.day)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    // The dayOfWeek carried alongside is still the raw dow, because the screen compares
    // it against `new Date().getDay()` to mark today — which is also 0 = Sunday.
    expect(days.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("says Closed rather than a time range on a closed day", () => {
    const [closed] = scheduleFrom([row(3, "10:00:00", "21:00:00", true)]);
    expect(closed.closed).toBe(true);
    expect(closed.text).toBe("Closed");
  });

  it("reads the times literally, without shifting them into the device timezone", () => {
    // open_time is a bare Postgres `time`: no date, no zone. Putting it through a Date
    // would move a 10am opening by the device's offset — five hours in Pakistan.
    const [day] = scheduleFrom([row(1, "09:30:00", "18:05:00")]);
    expect(day.text).toBe("9:30 AM – 6:05 PM");
  });

  it("returns nothing for a salon with no hours on file", () => {
    expect(scheduleFrom([])).toEqual([]);
  });
});
