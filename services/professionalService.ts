export type ProfessionalBookingStatus =
  | "confirmed"
  | "checked_in"
  | "in_service"
  | "completed"
  | "no_show";

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

// Integration boundary for migration 012. Keep these functions field-agnostic
// until its deployed schema and policies are confirmed.
export async function fetchProfessionalProfile() {
  await delay();
  return { ...profile, linkedServices: [...profile.linkedServices] };
}

export async function fetchAssignedBookings() {
  await delay();
  return bookings.map((booking) => ({ ...booking }));
}

export async function fetchAssignedBooking(id: string) {
  await delay();
  const booking = bookings.find((item) => item.id === id);
  return booking ? { ...booking } : null;
}

export async function updateAssignedBookingStatus(id: string, status: ProfessionalBookingStatus) {
  await delay();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) throw new Error("Assigned booking not found.");
  const updated = { ...booking, status };
  bookings = bookings.map((item) => (item.id === id ? updated : item));
  return { ...updated };
}
