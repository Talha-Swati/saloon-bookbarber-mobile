import { AvailabilitySlot, Booking, Salon, Service } from "@/types";
import { requireSupabaseConfig, supabase } from "@/services/supabase";
import { formatClockTime, formatDateLabel, formatDbTime } from "@/utils/format";
type Row = Record<string, any>;
const number = (value: unknown) => Number(value ?? 0);
const serviceFrom = (row: Row): Service => ({
  id: String(row.id),
  name: row.name ?? row.service_name ?? "Service",
  price: number(row.price_snapshot ?? row.price),
  duration: number(
    row.duration_snapshot_minutes ?? row.duration_minutes ?? row.duration,
  ),
  description: row.description ?? "",
  category: row.category?.name ?? row.service_categories?.name,
});
const hoursText = (hours: Row[]) =>
  hours.length
    ? hours
        .map((h) =>
          h.is_closed
            ? `${h.day_of_week}: Closed`
            : `${h.day_of_week}: ${formatDbTime(h.open_time)}–${formatDbTime(h.close_time)}`,
        )
        .join(" · ")
    : "Hours unavailable";
const salonFrom = (
  row: Row,
  services: Service[] = [],
  hours: Row[] = [],
  ratingInfo?: { rating: number; count: number },
): Salon => ({
  id: String(row.id),
  name: row.name ?? "Salon",
  area: row.area ?? row.address ?? "",
  city: row.city ?? "",
  rating: ratingInfo?.rating ?? 0,
  reviews: ratingInfo?.count ?? 0,
  distanceKm: number(row.distance_km),
  startingPrice: services.length
    ? Math.min(...services.map((x) => x.price))
    : number(row.starting_price),
  featured: Boolean(row.featured ?? row.is_featured),
  accent: row.accent ?? "#064E3B",
  isOpen: row.is_open ?? row.is_active ?? false,
  description: row.description ?? "",
  hours: hoursText(hours),
  services,
  reviewPreview: [],
});
async function activeServices(salonId: string) {
  const { data, error } = await supabase
    .from("salon_services")
    .select("*, service_categories(name)")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(serviceFrom);
}
async function salonHours(salonId: string) {
  const { data, error } = await supabase
    .from("salon_hours")
    .select("*")
    .eq("salon_id", salonId)
    .order("day_of_week");
  if (error) throw error;
  return data ?? [];
}
// reviews (supabase/migrations/013_reviews.sql) has no denormalized rating on `salons`
// itself, so the average/count is computed here from the real rows each request.
async function salonRatings(
  salonIds: string[],
): Promise<Map<string, { rating: number; count: number }>> {
  const map = new Map<string, { rating: number; count: number }>();
  if (!salonIds.length) return map;
  const { data, error } = await supabase
    .from("reviews")
    .select("salon_id,rating")
    .in("salon_id", salonIds);
  if (error) throw error;
  const sums = new Map<string, { total: number; count: number }>();
  for (const row of (data ?? []) as Row[]) {
    const id = String(row.salon_id);
    const entry = sums.get(id) ?? { total: 0, count: 0 };
    entry.total += number(row.rating);
    entry.count += 1;
    sums.set(id, entry);
  }
  sums.forEach((entry, id) => {
    map.set(id, { rating: entry.total / entry.count, count: entry.count });
  });
  return map;
}
export async function fetchSalons(): Promise<Salon[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("salons")
    .select("*")
    .eq("status", "approved")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  const rows = data ?? [];
  const ratings = await salonRatings(rows.map((row) => String(row.id)));
  return Promise.all(
    rows.map(async (row) => {
      const [services, hours] = await Promise.all([
        activeServices(row.id),
        salonHours(row.id),
      ]);
      return salonFrom(row, services, hours, ratings.get(String(row.id)));
    }),
  );
}
export async function fetchSalon(id: string): Promise<Salon | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("salons")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [services, hours, ratings] = await Promise.all([
    activeServices(id),
    salonHours(id),
    salonRatings([id]),
  ]);
  return salonFrom(data, services, hours, ratings.get(id));
}
// get_service_availability(p_salon_id uuid, p_service_id uuid, p_booking_date date) —
// verified character-for-character against saloon-bookbarber-web/supabase/migrations
// /007_booking_phase1.sql (unchanged by every later migration that touches this
// function's body). Called directly with its real argument names — no prefixed/plain
// fallback: that pattern existed to guess around an unverified signature, and guessing
// is exactly what caused the create_customer_booking bug below.
export async function fetchAvailability(
  salonId: string,
  serviceId: string,
  bookingDate: string,
): Promise<AvailabilitySlot[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("get_service_availability", {
    p_salon_id: salonId,
    p_service_id: serviceId,
    p_booking_date: bookingDate,
  });
  if (error) throw error;
  return ((data ?? []) as Row[])
    .map((row) => ({
      startTime: row.slot_start,
      endTime: row.slot_end,
      // Returns `available_capacity`, not `available`/`is_available` — a slot is
      // bookable only when capacity remains.
      available: number(row.available_capacity) > 0,
    }))
    .filter((x) => x.available && x.startTime);
}export type CreatedBookingItem = {
  id: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  price: number;
};
export type CreatedBookingGroup = {
  groupId: string | null;
  items: CreatedBookingItem[];
  total: number;
};
// create_customer_booking_group(p_service_ids uuid[], p_start_time timestamptz, ...) —
// supabase/migrations/016_multi_service_bookings.sql (unapplied until Talha runs
// 013-016 in order). Mirrors saloon-bookbarber-web/src/lib/salons/queries.ts's
// createBookingGroup exactly (same RPC name, same argument names, same return
// shape) — one shared contract, not two that can drift apart again the way
// create_customer_booking's argument names once did between these two clients.
// Books every id in serviceIds back-to-back in that order for one visit; the
// server (not this client) computes each service's real start/end time.
export async function createBookingGroup(input: {
  serviceIds: string[];
  startTime: string;
  notes?: string | null;
}): Promise<CreatedBookingGroup> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("create_customer_booking_group", {
    p_service_ids: input.serviceIds,
    p_start_time: input.startTime,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const items = rows.map((row) => ({
    id: String(row.id),
    serviceName: row.service_name_snapshot ?? "Service",
    startTime: row.start_time,
    endTime: row.end_time,
    price: number(row.service_price_snapshot),
  }));
  return {
    groupId: rows[0]?.booking_group_id ?? null,
    items,
    total: items.reduce((sum, item) => sum + item.price, 0),
  };
}
const bookingFrom = (row: Row): Booking => {
  const salon = Array.isArray(row.salons) ? row.salons[0] : row.salons;
  const service = Array.isArray(row.salon_services)
    ? row.salon_services[0]
    : row.salon_services;
  const status = String(row.status).toLowerCase();
  return {
    id: String(row.id),
    salonName: salon?.name ?? "Salon",
    serviceName: row.service_name_snapshot ?? service?.name ?? "Service",
    date: formatDateLabel(row.start_time),
    time: formatClockTime(row.start_time),
    duration: number(
      row.duration_minutes_snapshot ?? service?.duration_minutes,
    ),
    price: number(row.service_price_snapshot ?? service?.price),
    // No deposit/payment system exists yet (see docs/PAYMENTS-SCOPING.md in the web
    // repo) — every booking is pay-at-salon in full.
    deposit: 0,
    paymentMethod: "At salon",
    paymentStatus: "Pay at salon",
    status:
      status === "completed"
        ? "completed"
        : status === "cancelled"
          ? "cancelled"
          : "upcoming",
  };
};
export async function fetchMyBookings(): Promise<Booking[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, salons(name), salon_services(name,duration_minutes,price)")
    .order("start_time", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(bookingFrom);
}
export async function fetchBooking(id: string): Promise<Booking | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, salons(name), salon_services(name,duration_minutes,price)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? bookingFrom(data) : null;
}
export function bookingErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : String((error as Row)?.message ?? error);
  if (message.includes("SLOT_UNAVAILABLE") || message.includes("SLOT_FULL"))
    return "That slot is no longer available. Please choose another time.";
  if (/auth|jwt|session/i.test(message))
    return "Please sign in before booking.";
  if (/inactive.*salon|salon.*inactive/i.test(message))
    return "This salon is not accepting bookings.";
  if (/inactive.*service|service.*inactive/i.test(message))
    return "This service is no longer available.";
  if (message.includes("AT_LEAST_ONE_SERVICE_REQUIRED"))
    return "Select at least one service to book.";
  if (message.includes("SERVICES_MUST_BELONG_TO_SAME_SALON"))
    return "All selected services must be from this salon.";
  if (message.includes("VISIT_DOES_NOT_FIT_TODAY"))
    return "This combination of services doesn't fit before closing at that start time — try an earlier time or fewer services.";
  return message || "Something went wrong. Please try again.";
}
