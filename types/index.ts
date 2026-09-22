export type Service = {
  id: string;
  name: string;
  /**
   * What the customer pays. Since migration 030 this is the salon's price plus the
   * platform fee whenever the applicable commission rule charges on top, so it is the
   * only field that belongs in a total, a deposit or a "you pay" line.
   */
  price: number;
  /** What the salon charges, before the platform fee. Shown only to explain the split. */
  salonPrice: number;
  /** Zero when the commission is taken out of the salon's price rather than added to it. */
  platformFee: number;
  duration: number;
  description: string;
  category?: string;
};
export type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
};
export type Salon = {
  id: string;
  name: string;
  area: string;
  city: string;
  // Phase 2A (saloon-bookbarber-web/supabase/migrations/018_salon_location.sql). WGS84
  // decimal degrees, or null when this salon has no location on file — which is every
  // salon until one is entered, so every reader must handle null. Turning these
  // coordinates into a real distance is Phase 2B; there is deliberately no distanceKm
  // field until then, because the placeholder one rendered as " · 0 km" on every card.
  latitude: number | null;
  longitude: number | null;
  /**
   * Average of this salon's reviews, or null when it has none.
   *
   * Deliberately nullable rather than 0. `salons` has no denormalized rating column, so
   * this is computed per request from the `reviews` rows; a brand-new salon has nothing
   * to average, and rendering that as 0 tells a customer the salon is rated one star out
   * of five when in fact nobody has said anything. The web directory already hides the
   * figure entirely in that case (`salon.rating > 0 &&`), and this type is what makes
   * the app able to do the same.
   */
  rating: number | null;
  reviews: number;
  startingPrice: number;
  isOpen: boolean;
  description: string;
  /**
   * One row per day the salon has hours on file, Monday first.
   *
   * This was a single pre-joined string, and it was unreadable: `salon_hours.day_of_week`
   * is a Postgres `dow` integer (0 = Sunday) and the mapper interpolated it raw, so the
   * app told customers the salon opened on "0", "1" and "2". It also joined all seven
   * days with a middle dot into one paragraph, which no one reads to find out whether a
   * place is open on Sunday. Structured rows let the screen name the days and mark today.
   */
  openingHours: DaySchedule[];
  services: Service[];
  reviewPreview: Review[];
};
export type DaySchedule = {
  /** 0 = Sunday, matching Postgres `extract(dow ...)` and `salon_hours.day_of_week`. */
  dayOfWeek: number;
  /** "Monday". */
  day: string;
  /** "10:00 AM – 9:00 PM", or "Closed". */
  text: string;
  closed: boolean;
};

export type Booking = {
  id: string;
  salonName: string;
  serviceName: string;
  /**
   * The raw `bookings.start_time` (timestamptz), alongside the two formatted strings
   * below rather than instead of them.
   *
   * `date` and `time` are already-rendered text, which is all a card needs but is useless
   * for anything that has to compare one booking to another or to now — sorting the
   * upcoming list soonest-first, deciding which appointment is the *next* one, or saying
   * "Tomorrow" instead of a date. Every one of those was previously impossible on the
   * client, and "your next appointment" on the home screen was quietly picking whichever
   * upcoming booking the query happened to return first, which was the furthest away.
   */
  startTime: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  deposit: number;
  paymentMethod: string;
  paymentStatus: "Deposit paid" | "Pay at salon";
  status: "upcoming" | "completed" | "cancelled";
  /**
   * The real booking_status, in words. `status` above is a three-way grouping for the
   * tab bar and throws away the distinction between "confirmed", "checked in" and
   * "in progress" — all of which a customer standing in the salon very much wants to
   * see, and between "cancelled" and "missed", which are not the same thing at all.
   */
  statusLabel: string;
  /** Assigned barber, once one has been. Null while the booking is unassigned. */
  professionalName: string | null;
  // Whether transition_booking_status would accept a customer cancellation of this
  // booking (raw status pending_payment or confirmed). The three-way `status` above is
  // a display grouping and is too coarse to decide that: it files no_show, checked_in
  // and in_service under "upcoming", none of which a customer may cancel. The server
  // re-checks regardless — this only decides whether the button is offered.
  canCancel: boolean;
};
// Phase 3D-2A. Mirrors saloon-bookbarber-web/src/lib/salons/types.ts exactly — the
// `payments` row (003_payments_settlements.sql) narrowed to what a customer may see
// about their own booking. `amount` and `currency` are whatever the server decided in
// initialize_booking_payment; no client path can set either.
export type PaymentStatus =
  | "requires_payment"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type BookingPayment = {
  id: string;
  bookingId: string;
  kind: string;
  method: string;
  provider: string | null;
  providerPaymentId: string | null;
  providerReference: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  type:
    | "confirmed"
    | "reminder"
    | "rescheduled"
    | "cancelled"
    | "payment"
    | "review";
  title: string;
  message: string;
  time: string;
  read: boolean;
};
export type AvailabilitySlot = {
  startTime: string;
  endTime?: string;
  available: boolean;
};
