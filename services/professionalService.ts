import { requireSupabaseConfig, supabase } from "@/services/supabase";

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

// Integration boundary for migration 012. Keep these functions field-agnostic
// until its deployed schema and policies are confirmed.
export async function fetchProfessionalProfile(mode: ProfessionalDataMode) {
  if (mode === "remote")
    throw new Error("Professional backend reads are not configured in this mobile build. Confirm migration 012 fields before enabling them.");
  await delay();
  return { ...profile, linkedServices: [...profile.linkedServices] };
}

export async function fetchAssignedBookings(mode: ProfessionalDataMode) {
  if (mode === "remote")
    throw new Error("Professional backend reads are not configured in this mobile build. Confirm migration 012 fields before enabling them.");
  await delay();
  return bookings.map((booking) => ({ ...booking }));
}

export async function fetchAssignedBooking(id: string, mode: ProfessionalDataMode) {
  if (mode === "remote")
    throw new Error("Professional backend reads are not configured in this mobile build. Confirm migration 012 fields before enabling them.");
  await delay();
  const booking = bookings.find((item) => item.id === id);
  return booking ? { ...booking } : null;
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
  if (/Professional backend reads are not configured/.test(message)) return message;
  return "Unable to complete this professional operation. Please try again.";
}
