import { AvailabilitySlot, Booking, Salon, Service } from "@/types";
import { requireSupabaseConfig, supabase } from "@/services/supabase";
type Row = Record<string, any>;
const number = (value: unknown) => Number(value ?? 0);
const timeLabel = (value: string) => {
  if (!value) return "";
  const part = value.includes("T") ? value.split("T")[1] : value;
  const [h, m] = part.split(":").map(Number);
  if (Number.isNaN(h)) return value;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
// `bookings` has no separate date column (supabase/migrations/002_booking_commission.sql)
// — the date is derived from the `start_time` timestamptz.
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
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
            : `${h.day_of_week}: ${timeLabel(h.open_time)}–${timeLabel(h.close_time)}`,
        )
        .join(" · ")
    : "Hours unavailable";
const salonFrom = (
  row: Row,
  services: Service[] = [],
  hours: Row[] = [],
): Salon => ({
  id: String(row.id),
  name: row.name ?? "Salon",
  area: row.area ?? row.address ?? "",
  city: row.city ?? "",
  rating: number(row.rating_average ?? row.rating),
  reviews: number(row.review_count ?? row.reviews),
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
export async function fetchSalons(): Promise<Salon[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("salons")
    .select("*")
    .eq("status", "approved")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const [services, hours] = await Promise.all([
        activeServices(row.id),
        salonHours(row.id),
      ]);
      return salonFrom(row, services, hours);
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
  const [services, hours] = await Promise.all([
    activeServices(id),
    salonHours(id),
  ]);
  return salonFrom(data, services, hours);
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
}
export type CreatedBooking = {
  id: string;
  salonName: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  total: number;
  deposit: number;
  remaining: number;
};
// create_customer_booking(p_service_id uuid, p_start_time timestamptz, p_notes text
// default null, p_booking_source booking_source default 'customer_app') — verified
// character-for-character against 007_booking_phase1.sql (unchanged by 008-011, which
// only patch the function body's internal validation logic via pg_get_functiondef,
// never its parameter list). There is no p_salon_id or p_booking_date parameter — the
// salon is resolved server-side from the service (v_service.salon_id in the function
// body), which is also why input.salonId/input.bookingDate below are accepted from the
// caller but not sent to the RPC. The previous prefixed ({p_salon_id, p_booking_date,
// ...}) and plain ({salon_id, booking_date, ...}) argument sets both included those two
// nonexistent parameters, so every booking attempt failed with a "could not find the
// function" error regardless of which one PostgREST tried — this was a real,
// previously-undiscovered break in the customer booking flow, not a hypothetical one.
export async function createBooking(input: {
  salonId: string;
  serviceId: string;
  bookingDate: string;
  startTime: string;
}): Promise<CreatedBooking> {
  requireSupabaseConfig();
  const { data, error: rpcError } = await supabase.rpc("create_customer_booking", {
    p_service_id: input.serviceId,
    p_start_time: input.startTime,
  });
  if (rpcError) throw rpcError;
  const rpcRow = Array.isArray(data) ? data[0] : data;
  const bookingId =
    typeof rpcRow === "string" ? rpcRow : (rpcRow.booking_id ?? rpcRow.id);
  // salon_id -> salons(id) and service_id -> salon_services(id): the embed key is the
  // referenced table's name, so "services" (no such table) never matched anything.
  const { data: saved, error } = await supabase
    .from("bookings")
    .select("*, salons(name), salon_services(name,price)")
    .eq("id", bookingId)
    .single();
  if (error) throw error;
  const salon = Array.isArray(saved.salons) ? saved.salons[0] : saved.salons;
  const service = Array.isArray(saved.salon_services)
    ? saved.salon_services[0]
    : saved.salon_services;
  // No deposit/payment system exists yet (see docs/PAYMENTS-SCOPING.md in the web
  // repo) — every booking is pay-at-salon in full, so deposit is always 0.
  const total = number(saved.service_price_snapshot ?? service?.price);
  return {
    id: String(saved.id),
    salonName: salon?.name ?? "",
    serviceName: saved.service_name_snapshot ?? service?.name ?? "",
    bookingDate: saved.start_time ?? input.bookingDate,
    startTime: saved.start_time ?? input.startTime,
    total,
    deposit: 0,
    remaining: total,
  };
}
export type CreatedBookingItem = {
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
    date: dateLabel(row.start_time),
    time: timeLabel(row.start_time),
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
