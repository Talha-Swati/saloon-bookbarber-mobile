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
  hours: string;
  services: Service[];
  reviewPreview: Review[];
};
export type Booking = {
  id: string;
  salonName: string;
  serviceName: string;
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
