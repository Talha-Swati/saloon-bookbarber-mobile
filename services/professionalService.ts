import { requireSupabaseConfig, supabase } from "@/services/supabase";

type Row = Record<string, any>;

const timeLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dateLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  if (isSameDay(date, new Date())) return "today";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

export type ProfessionalBookingStatus =
  | "pending_payment"
  | "confirmed"
  | "checked_in"
  | "in_service"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export type ProfessionalBooking = {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: ProfessionalBookingStatus;
};

export type ProfessionalProfile = {
  id: string;
  name: string;
  salonName: string;
  specialty: string;
  linkedServices: string[];
  working: boolean;
};

const profile: ProfessionalProfile = {
  id: "demo-professional",
  name: "Ahmed Khan",
  salonName: "The Gentlemen's Lounge",
  specialty: "Haircuts and beard grooming",
  linkedServices: ["Classic Haircut", "Haircut & Beard Trim", "Beard Trim"],
  working: true,
};

let bookings: ProfessionalBooking[] = [
  { id: "pro-b1", customerName: "Hamza Ali", customerPhone: "+92 300 1234567", serviceName: "Classic Haircut", date: "today", time: "10:30 AM", durationMinutes: 45, status: "confirmed" },
  { id: "pro-b2", customerName: "Usman Raza", customerPhone: "+92 301 7654321", serviceName: "Haircut & Beard Trim", date: "today", time: "12:00 PM", durationMinutes: 60, status: "checked_in" },
  { id: "pro-b3", customerName: "Bilal Ahmed", customerPhone: "+92 321 1122334", serviceName: "Beard Trim", date: "today", time: "2:30 PM", durationMinutes: 30, status: "completed" },
  { id: "pro-b4", customerName: "Omar Farooq", customerPhone: "+92 333 9988776", serviceName: "Classic Haircut", date: "Tomorrow", time: "11:00 AM", durationMinutes: 45, status: "confirmed" },
  { id: "pro-b5", customerName: "Saad Malik", customerPhone: "+92 302 4455667", serviceName: "Haircut & Beard Trim", date: "Mon, 7 Sep", time: "4:00 PM", durationMinutes: 60, status: "confirmed" },
];

const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

export type ProfessionalDataMode = "demo" | "remote";

const allowedTransitions: Partial<Record<ProfessionalBookingStatus, ProfessionalBookingStatus[]>> = {
  confirmed: ["checked_in", "no_show"],
  checked_in: ["in_service"],
  in_service: ["completed"],
};

// Integration boundary for migration 012 (professionals, professional_services, bookings
// snapshot columns). Field mapping confirmed against
// saloon-bookbarber-web/supabase/migrations/012_professional_phase1.sql — see
// SESSION-REPORT.md Phase 3. RLS (professionals_own_select, bookings_professional_select_assigned)
// scopes every query below to the signed-in professional's own row/bookings; no client-side
// filtering by user id is needed or done.
const bookingColumns =
  "id, status, start_time, customer_name_snapshot, customer_phone_snapshot, service_name_snapshot, duration_minutes_snapshot";

function bookingFromRow(row: Row): ProfessionalBooking {
  return {
    id: String(row.id),
    customerName: row.customer_name_snapshot ?? "Customer",
    customerPhone: row.customer_phone_snapshot ?? "",
    serviceName: row.service_name_snapshot ?? "Service",
    date: dateLabel(row.start_time),
    time: timeLabel(row.start_time),
    durationMinutes: Number(row.duration_minutes_snapshot ?? 0),
    status: row.status as ProfessionalBookingStatus,
  };
}

export async function fetchProfessionalProfile(mode: ProfessionalDataMode) {
  if (mode === "demo") {
    await delay();
    return { ...profile, linkedServices: [...profile.linkedServices] };
  }
  requireSupabaseConfig();
  const { data: prof, error } = await supabase
    .from("professionals")
    .select("id, display_name, specialty, is_active, salons(name)")
    .maybeSingle();
  if (error) throw error;
  if (!prof) throw new Error("No professional profile is linked to this account.");

  const { data: links, error: linksError } = await supabase
    .from("professional_services")
    .select("service_id")
    .eq("professional_id", prof.id);
  if (linksError) throw linksError;

  const serviceIds = (links ?? []).map((link: Row) => link.service_id);
  let linkedServices: string[] = [];
  if (serviceIds.length) {
    const { data: services, error: servicesError } = await supabase
      .from("salon_services")
      .select("name")
      .in("id", serviceIds);
    if (servicesError) throw servicesError;
    linkedServices = (services ?? []).map((service: Row) => service.name);
  }

  const salon = Array.isArray(prof.salons) ? prof.salons[0] : prof.salons;
  return {
    id: String(prof.id),
    name: prof.display_name,
    salonName: salon?.name ?? "",
    specialty: prof.specialty,
    linkedServices,
    working: Boolean(prof.is_active),
  };
}

export async function fetchAssignedBookings(mode: ProfessionalDataMode) {
  if (mode === "demo") {
    await delay();
    return bookings.map((booking) => ({ ...booking }));
  }
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select(bookingColumns)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(bookingFromRow);
}

// Booking-sync session (2026-09-12): previously the only refresh trigger for a
// professional's bookings was `useFocusEffect` (navigate away and back). A booking a
// customer makes right now would not appear until the professional left and returned
// to the screen. This subscribes to live changes on the professional's own assigned
// bookings, same `postgres_changes` pattern as the web repo's
// components/employee/EmployeeNotificationBell.tsx (channel + `.on("postgres_changes",
// ...)` + `.subscribe()`), filtered server-side by `professional_id` — RLS
// (`bookings_professional_select_assigned`) already scopes this to the caller's own
// rows regardless, the filter just avoids waking the client for other professionals'
// bookings.
export function subscribeToAssignedBookings(professionalId: string, onChange: () => void) {
  const channel = supabase
    .channel(`professional-bookings-${professionalId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `professional_id=eq.${professionalId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchAssignedBooking(id: string, mode: ProfessionalDataMode) {
  if (mode === "demo") {
    await delay();
    const booking = bookings.find((item) => item.id === id);
    return booking ? { ...booking } : null;
  }
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select(bookingColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? bookingFromRow(data) : null;
}

export async function transitionAssignedBookingStatus(input: {
  booking: ProfessionalBooking;
  targetStatus: ProfessionalBookingStatus;
  reason?: string | null;
  mode: ProfessionalDataMode;
}) {
  const allowed = allowedTransitions[input.booking.status] ?? [];
  if (!allowed.includes(input.targetStatus))
    throw new Error("This booking status change is not allowed.");
  if (input.mode === "demo") {
    await delay();
    const updated = { ...input.booking, status: input.targetStatus };
    bookings = bookings.map((item) => item.id === input.booking.id ? updated : item);
    return updated;
  }
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("transition_booking_status", {
    p_booking_id: input.booking.id,
    p_to_status: input.targetStatus,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || String(row.id) !== input.booking.id || String(row.status) !== input.targetStatus)
    throw new Error("The booking update returned an invalid response.");
  return { ...input.booking, status: input.targetStatus };
}

export function professionalErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  if (/jwt|session|auth/i.test(message)) return "Your session expired. Please sign in again.";
  if (/not allowed|invalid transition/i.test(message)) return "This booking status change is not allowed.";
  if (/network|fetch|offline/i.test(message)) return "Unable to connect. Check your internet connection and try again.";
  if (/No professional profile is linked/.test(message)) return message;
  return "Unable to complete this professional operation. Please try again.";
}
