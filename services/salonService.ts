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
const dateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
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
async function rpcWithArgs<T>(
  name: string,
  prefixed: Row,
  plain: Row,
): Promise<T> {
  let result = await supabase.rpc(name, prefixed);
  if (result.error?.code === "PGRST202")
    result = await supabase.rpc(name, plain);
  if (result.error) throw result.error;
  return result.data as T;
}
export async function fetchAvailability(
  salonId: string,
  serviceId: string,
  bookingDate: string,
): Promise<AvailabilitySlot[]> {
  requireSupabaseConfig();
  const data = await rpcWithArgs<any[]>(
    "get_service_availability",
    {
      p_salon_id: salonId,
      p_service_id: serviceId,
      p_booking_date: bookingDate,
    },
    { salon_id: salonId, service_id: serviceId, booking_date: bookingDate },
  );
  return (data ?? [])
    .map((row) => ({
      startTime: row.start_time ?? row.slot_start ?? row.time,
      endTime: row.end_time ?? row.slot_end,
      available: row.available ?? row.is_available ?? true,
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
export async function createBooking(input: {
  salonId: string;
  serviceId: string;
  bookingDate: string;
  startTime: string;
}): Promise<CreatedBooking> {
  requireSupabaseConfig();
  const data = await rpcWithArgs<string | Row | Row[]>(
    "create_customer_booking",
    {
      p_salon_id: input.salonId,
      p_service_id: input.serviceId,
      p_booking_date: input.bookingDate,
      p_start_time: input.startTime,
    },
    {
      salon_id: input.salonId,
      service_id: input.serviceId,
      booking_date: input.bookingDate,
      start_time: input.startTime,
    },
  );
  const rpcRow = Array.isArray(data) ? data[0] : data;
  const bookingId =
    typeof rpcRow === "string" ? rpcRow : (rpcRow.booking_id ?? rpcRow.id);
  const { data: saved, error } = await supabase
    .from("bookings")
    .select("*, salons(name), services(name)")
    .eq("id", bookingId)
    .single();
  if (error) throw error;
  const salon = Array.isArray(saved.salons) ? saved.salons[0] : saved.salons;
  const service = Array.isArray(saved.services)
    ? saved.services[0]
    : saved.services;
  return {
    id: String(saved.id),
    salonName: saved.salon_name_snapshot ?? salon?.name ?? "",
    serviceName: saved.service_name_snapshot ?? service?.name ?? "",
    bookingDate: saved.booking_date ?? input.bookingDate,
    startTime: saved.start_time ?? input.startTime,
    total: number(
      saved.total_amount_snapshot ?? saved.total_amount ?? saved.price_snapshot,
    ),
    deposit: number(saved.deposit_amount_snapshot ?? saved.deposit_amount),
    remaining: number(
      saved.remaining_amount_snapshot ??
        saved.remaining_amount ??
        number(
          saved.total_amount_snapshot ??
            saved.total_amount ??
            saved.price_snapshot,
        ) - number(saved.deposit_amount_snapshot ?? saved.deposit_amount),
    ),
  };
}
const bookingFrom = (row: Row): Booking => {
  const salon = Array.isArray(row.salons) ? row.salons[0] : row.salons;
  const service = Array.isArray(row.services) ? row.services[0] : row.services;
  const status = String(row.status).toLowerCase();
  return {
    id: String(row.id),
    salonName: row.salon_name_snapshot ?? salon?.name ?? "Salon",
    serviceName: row.service_name_snapshot ?? service?.name ?? "Service",
    date: dateLabel(row.booking_date),
    time: timeLabel(row.start_time),
    duration: number(
      row.duration_snapshot_minutes ?? service?.duration_minutes,
    ),
    price: number(
      row.total_amount_snapshot ?? row.total_amount ?? row.price_snapshot,
    ),
    deposit: number(row.deposit_amount_snapshot ?? row.deposit_amount),
    paymentMethod: row.payment_method ?? "At salon",
    paymentStatus:
      number(row.deposit_amount_snapshot ?? row.deposit_amount) > 0
        ? "Deposit paid"
        : "Pay at salon",
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
    .select("*, salons(name), services(name,duration_minutes)")
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(bookingFrom);
}
export async function fetchBooking(id: string): Promise<Booking | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, salons(name), services(name,duration_minutes)")
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
  if (message.includes("SLOT_UNAVAILABLE"))
    return "That slot is no longer available. Please choose another time.";
  if (/auth|jwt|session/i.test(message))
    return "Please sign in before booking.";
  if (/inactive.*salon|salon.*inactive/i.test(message))
    return "This salon is not accepting bookings.";
  if (/inactive.*service|service.*inactive/i.test(message))
    return "This service is no longer available.";
  return message || "Something went wrong. Please try again.";
}
