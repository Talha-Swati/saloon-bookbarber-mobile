import {
  AvailabilitySlot,
  Booking,
  BookingPayment,
  PaymentStatus,
  Salon,
  Service,
} from "@/types";
import { requireSupabaseConfig, supabase } from "@/services/supabase";
import { apiBaseUrl, apiUrl } from "@/services/api";
import { formatClockTime, formatDateLabel } from "@/utils/format";
import { scheduleFrom } from "@/utils/openingHours";
type Row = Record<string, any>;
const number = (value: unknown) => Number(value ?? 0);

// latitude/longitude are numeric(9,6) (saloon-bookbarber-web/supabase/migrations
// /018_salon_location.sql) and arrive from PostgREST as strings, or as null when the
// salon has no location on file. Deliberately NOT routed through `number()` above:
// that maps null to 0, and 0,0 is a real place in the Gulf of Guinea, so every
// unlocated salon would claim to sit there.
const coordinate = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// The exact condition that makes a registered salon publicly discoverable, taken from
// salons_customer_select_public in 005_rls_policies.sql, and the same constant the web
// client now holds in src/lib/salons/queries.ts. Phase 2B's nearby-salon query must
// filter on this same condition — one definition, not a third copy of the literals.
export const DISCOVERABLE_SALON: { status: string; is_active: boolean } = {
  status: "approved",
  is_active: true,
};
// Phase 2B basic discovery. Mirrors saloon-bookbarber-web/src/lib/salons/queries.ts's
// salonMatchesSearch exactly — one matcher shared by the home screen and the Salons
// tab, so the two screens cannot drift into two different search behaviours. Applied
// to the already-fetched list rather than as a new query: fetchSalons() returns every
// discoverable salon in one request, so this adds no round trips and needs no index.
// Each whitespace-separated term must match somewhere, case-insensitively and
// partially, across name / city / area / service names. latitude and longitude are
// deliberately NOT used: nearby and distance search are a later phase.
export function salonMatchesSearch(salon: Salon, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [
    salon.name,
    salon.city,
    salon.area,
    ...salon.services.map((x) => x.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
// Salon menus read salon_services_public (migration 030), not salon_services. On that
// view `price` is already what the customer will be charged -- the salon's own price
// plus the platform fee whenever the applicable commission rule charges on top -- from
// the same resolve_service_commission() that create_customer_booking uses to price the
// booking. Reading salon_services.price here would show one number and charge another,
// and the web app would disagree with this screen.
//
// The price_snapshot / duration_snapshot_minutes fallbacks stay because this mapper is
// also handed booking rows, where the snapshot IS the customer price already.
const serviceFrom = (row: Row): Service => ({
  id: String(row.id),
  name: row.name ?? row.service_name ?? "Service",
  price: number(row.price_snapshot ?? row.price),
  salonPrice: number(row.salon_price ?? row.price_snapshot ?? row.price),
  platformFee: number(row.platform_fee),
  duration: number(
    row.duration_snapshot_minutes ?? row.duration_minutes ?? row.duration,
  ),
  description: row.description ?? "",
  category: row.category_name ?? row.category?.name ?? row.service_categories?.name,
});
const salonFrom = (
  row: Row,
  services: Service[] = [],
  hours: Row[] = [],
  ratingInfo?: { rating: number; count: number },
): Salon => ({
  id: String(row.id),
  name: row.name ?? "Salon",
  // `area` is the neighbourhood column added in 018_salon_location.sql. This
  // area-then-address precedence predates it and already handled the column being
  // absent, so nothing on screen changes until an area is actually entered.
  area: row.area ?? row.address ?? "",
  city: row.city ?? "",
  latitude: coordinate(row.latitude),
  longitude: coordinate(row.longitude),
  // Null when nobody has reviewed this salon yet, NOT 0. The two are different claims —
  // 0 says "rated, and badly" — and every renderer has to be able to tell them apart.
  rating: ratingInfo ? ratingInfo.rating : null,
  reviews: ratingInfo?.count ?? 0,
  startingPrice: services.length ? Math.min(...services.map((x) => x.price)) : 0,
  // `salons` carries no status column beyond these two, and a salon is open only when
  // both agree — the same rule salons_customer_select_public enforces and the same one
  // the web client's salonFrom applies. The previous `row.is_open ?? row.is_active` read
  // a column that does not exist, so it silently fell through to is_active alone and
  // called an unapproved salon open.
  isOpen: row.status === "approved" && row.is_active === true,
  // There is no `salons.description`. The web client builds this line from the address,
  // so the same salon described itself on the website and said nothing in the app.
  description: row.address ? `${row.address}, ${row.city ?? ""}`.trim() : (row.city ?? ""),
  openingHours: scheduleFrom(hours),
  services,
  reviewPreview: [],
});
async function activeServices(salonId: string) {
  const { data, error } = await supabase
    .from("salon_services_public")
    .select("*")
    .eq("salon_id", salonId)
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
// Batched counterparts to activeServices/salonHours. The salon list feeds both the
// home screen and the Salons tab, and previously issued two requests per salon inside
// a map; these keep it to a flat 4 regardless of how many salons load. Same filters
// and ordering as the single-salon versions, so rendered output is unchanged.
async function activeServicesFor(salonIds: string[]): Promise<Map<string, Service[]>> {
  const map = new Map<string, Service[]>();
  if (!salonIds.length) return map;
  const { data, error } = await supabase
    .from("salon_services_public")
    .select("*")
    .in("salon_id", salonIds)
    .order("name");
  if (error) throw error;
  for (const row of (data ?? []) as Row[]) {
    const id = String(row.salon_id);
    const list = map.get(id) ?? [];
    list.push(serviceFrom(row));
    map.set(id, list);
  }
  return map;
}

async function salonHoursFor(salonIds: string[]): Promise<Map<string, Row[]>> {
  const map = new Map<string, Row[]>();
  if (!salonIds.length) return map;
  const { data, error } = await supabase
    .from("salon_hours")
    .select("*")
    .in("salon_id", salonIds)
    .order("day_of_week");
  if (error) throw error;
  for (const row of (data ?? []) as Row[]) {
    const id = String(row.salon_id);
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

export async function fetchSalons(): Promise<Salon[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("salons")
    .select("*")
    .match(DISCOVERABLE_SALON)
    .order("name");
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((row) => String(row.id));
  const [ratings, services, hours] = await Promise.all([
    salonRatings(ids),
    activeServicesFor(ids),
    salonHoursFor(ids),
  ]);
  return rows.map((row) => {
    const id = String(row.id);
    return salonFrom(row, services.get(id) ?? [], hours.get(id) ?? [], ratings.get(id));
  });
}
export async function fetchSalon(id: string): Promise<Salon | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("salons")
    .select("*")
    .eq("id", id)
    .match(DISCOVERABLE_SALON)
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
  // Phase 3D-2B: the status the SERVER gave this booking — 'pending_payment' at a salon
  // that requires a deposit, 'confirmed' otherwise. Decided by booking_initial_status
  // (021), never by the client.
  status: string;
};
export type CreatedBookingGroup = {
  groupId: string | null;
  items: CreatedBookingItem[];
  total: number;
  requiresPayment: boolean;
};
/** One line of a server-priced basket. */
export type BookingQuoteLine = {
  position: number;
  serviceId: string;
  serviceName: string;
  salonPrice: number;
  bookingFee: number;
  customerPrice: number;
};

export type BookingQuote = {
  lines: BookingQuoteLine[];
  /** What the salon charges for all of it, before the online booking fee. */
  salonTotal: number;
  /** The online booking fee across the whole visit. */
  bookingFee: number;
  /** What the customer pays. The only figure a checkout screen should total. */
  total: number;
};

/**
 * What a basket actually costs, priced by the server.
 *
 * quote_booking_group(p_service_ids uuid[]) —
 * supabase/migrations/033_progressive_markup_for_multi_service_bookings.sql.
 *
 * This exists because since 033 the booking fee is NOT the same for every service in a
 * visit: the second and later services carry a smaller fee than the first. Summing each
 * service's own `price` — which is what this screen used to do, and what the web app
 * used to do — therefore quotes a total higher than the database will charge. Both
 * clients now ask the server, so there is one answer rather than three.
 *
 * Mirrors saloon-bookbarber-web/src/lib/salons/queries.ts's quoteBookingGroup exactly:
 * same RPC, same argument name, same return shape. The portal-parity suite is what
 * keeps them that way.
 */
export async function quoteBookingGroup(serviceIds: string[]): Promise<BookingQuote> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("quote_booking_group", {
    p_service_ids: serviceIds,
  });
  if (error) throw error;

  const lines = ((data ?? []) as Row[]).map((row) => ({
    position: number(row.r_position),
    serviceId: String(row.r_service_id),
    serviceName: row.r_service_name ?? "Service",
    salonPrice: number(row.r_salon_price),
    bookingFee: number(row.r_booking_fee),
    customerPrice: number(row.r_customer_price),
  }));

  return {
    lines,
    salonTotal: lines.reduce((sum, line) => sum + line.salonPrice, 0),
    bookingFee: lines.reduce((sum, line) => sum + line.bookingFee, 0),
    total: lines.reduce((sum, line) => sum + line.customerPrice, 0),
  };
}

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
    status: String(row.status),
  }));
  return {
    groupId: rows[0]?.booking_group_id ?? null,
    items,
    total: items.reduce((sum, item) => sum + item.price, 0),
    requiresPayment: items.some((item) => item.status === "pending_payment"),
  };
}
// The real booking_status in words. The three-way `status` grouping below feeds the
// tab bar and is deliberately coarse; this is what actually gets shown on the card.
const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_service: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
  rescheduled: "Rescheduled",
};

// Which tab a booking files under.
//
// `no_show` and `rescheduled` used to fall through to "upcoming" because the old mapping
// only named completed and cancelled. A missed appointment therefore sat in a customer's
// Upcoming tab forever, looking like a live booking they could still turn up for.
const STATUS_GROUP: Record<string, Booking["status"]> = {
  pending_payment: "upcoming",
  confirmed: "upcoming",
  checked_in: "upcoming",
  in_service: "upcoming",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "cancelled",
  rescheduled: "cancelled",
};

const bookingFrom = (row: Row, barberNames?: Map<string, string>): Booking => {
  const salon = Array.isArray(row.salons) ? row.salons[0] : row.salons;
  const service = Array.isArray(row.salon_services)
    ? row.salon_services[0]
    : row.salon_services;
  const status = String(row.status).toLowerCase();
  const professionalId = row.professional_id ? String(row.professional_id) : null;
  return {
    id: String(row.id),
    canCancel: status === "confirmed" || status === "pending_payment",
    salonName: salon?.name ?? "Salon",
    serviceName: row.service_name_snapshot ?? service?.name ?? "Service",
    startTime: String(row.start_time ?? ""),
    date: formatDateLabel(row.start_time),
    time: formatClockTime(row.start_time),
    duration: number(
      row.duration_minutes_snapshot ?? service?.duration_minutes,
    ),
    price: number(row.service_price_snapshot ?? service?.price),
    // Payment is UI-only test mode for now (services/dummyPayment.ts): nothing is
    // recorded against the payments table, so there is no paid state to read back here.
    deposit: 0,
    paymentMethod: "At salon",
    paymentStatus: "Pay at salon",
    statusLabel: STATUS_LABELS[status] ?? status.replace(/_/g, " "),
    professionalName: professionalId ? (barberNames?.get(professionalId) ?? null) : null,
    status: STATUS_GROUP[status] ?? "upcoming",
  };
};

// Resolves assigned barbers to names.
//
// A separate query rather than a PostgREST embed: bookings -> professionals is a
// COMPOSITE foreign key on (professional_id, salon_id), which embedding does not select
// cleanly. Failure is swallowed on purpose — the customer read policy for `professionals`
// arrives in migration 026, and before it is applied this returns nothing rather than
// breaking the whole bookings list over a nice-to-have name.
async function professionalNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return map;
  const { data, error } = await supabase
    .from("professionals")
    .select("id,display_name")
    .in("id", unique);
  if (error) return map;
  for (const row of (data ?? []) as Row[]) map.set(String(row.id), String(row.display_name));
  return map;
}

export async function fetchMyBookings(): Promise<Booking[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, salons(name), salon_services(name,duration_minutes,price)")
    .order("start_time", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const names = await professionalNames(rows.map((row) => String(row.professional_id ?? "")));
  return rows.map((row) => bookingFrom(row, names));
}
export async function fetchBooking(id: string): Promise<Booking | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, salons(name), salon_services(name,duration_minutes,price)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const names = await professionalNames([String((data as Row).professional_id ?? "")]);
  return bookingFrom(data, names);
}

/**
 * Live updates for the signed-in customer's own bookings.
 *
 * The customer screen was the only one of the three panels with no subscription at all:
 * a salon admin checking someone in, or the auto-assignment naming their barber, showed
 * up only if the customer happened to navigate away and back.
 *
 * Filtered server-side on customer_id so the client is not woken for every booking in
 * the platform. RLS (bookings_customer_select_own) scopes it to this customer regardless
 * — the filter is about noise, not access.
 *
 * NOTE: this delivers nothing until `bookings` is in the supabase_realtime publication,
 * which migration 026 does. Before that the channel subscribes happily and stays silent.
 */
export function subscribeToMyBookings(customerId: string, onChange: () => void) {
  const channel = supabase
    .channel(`customer-bookings-${customerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `customer_id=eq.${customerId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
// Phase 3D-1 booking lifecycle. Mirrors saloon-bookbarber-web/src/lib/salons/queries.ts
// exactly — same RPCs, same argument names. The server owns ownership, eligibility and
// availability; neither call decides anything the database does not re-check.
export async function cancelBooking(
  bookingId: string,
  reason?: string | null,
): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("transition_booking_status", {
    p_booking_id: bookingId,
    p_to_status: "cancelled",
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

// reschedule_customer_booking — supabase/migrations/019_booking_lifecycle.sql (in the
// web repo). Moves the same booking row; the new start time must be a slot
// get_service_availability currently offers for that booking's own service.
export async function rescheduleBooking(
  bookingId: string,
  newStartTime: string,
  reason?: string | null,
): Promise<void> {
  requireSupabaseConfig();
  const { error } = await supabase.rpc("reschedule_customer_booking", {
    p_booking_id: bookingId,
    p_new_start_time: newStartTime,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

// Phase 3D-2A payment foundation. Mirrors the web data layer exactly — same table, same
// RPC, same argument names. No payment UI yet; these are the two calls a payment screen
// will need, and nothing more.
const paymentFrom = (row: Row): BookingPayment => ({
  id: String(row.id),
  bookingId: String(row.booking_id),
  kind: row.kind,
  method: row.payment_method,
  provider: row.provider ?? null,
  providerPaymentId: row.provider_payment_id ?? null,
  providerReference: row.provider_reference ?? null,
  amount: number(row.amount),
  currency: row.currency ?? "",
  status: row.status as PaymentStatus,
  paidAt: row.paid_at ?? null,
  createdAt: row.created_at,
});

// payments_customer_select_own (005_rls_policies.sql) scopes this to
// customer_id = auth.uid(), so another customer's payment can never come back here —
// it is not filtered client-side.
export async function fetchBookingPayments(
  bookingId: string,
): Promise<BookingPayment[]> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(paymentFrom);
}

// initialize_booking_payment — 020_booking_payment_foundation.sql in the web repo.
// There is deliberately no amount argument: the server derives it from the booking's
// own price snapshot and the salon's deposit settings. Idempotent — calling it again
// for a booking that already has an open payment returns that same record.
export async function initializeBookingPayment(
  bookingId: string,
  options: { method?: string; provider?: string | null } = {},
): Promise<BookingPayment> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("initialize_booking_payment", {
    p_booking_id: bookingId,
    p_payment_method: options.method ?? "wallet",
    p_provider: options.provider ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return paymentFrom(row as Row);
}

// Mirrors the web client's src/lib/payments/start-deposit.ts. Sends a booking id and
// nothing else — no amount, no currency, no status — so there is no field here through
// which a device could influence what it owes. The response is display data.
//
// Unlike every other call in this file, this one goes to the BookBarber web backend
// rather than straight to Supabase: payment initiation touches merchant credentials and
// service-role RPCs, which must never live in an app bundle. The Supabase access token
// is forwarded as a bearer so the route runs the RPC as this customer and its ownership
// check still applies.
export type DepositIntent = {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  // Same column as BookingPayment.status — the payments row's own status, so the two
  // stay assignable to each other rather than drifting into `string`.
  status: PaymentStatus;
  kind: string;
  providerReady: boolean;
  redirect?: {
    method: "GET" | "POST";
    url: string;
    // Easypaisa hosted checkout is a form POST, not a link. Dropping the fields
    // here would leave the app able to open the checkout page and unable to say
    // which booking it is for.
    fields?: Record<string, string> | null;
  } | null;
  error?: string;
};

export async function startDepositPayment(
  bookingId: string,
): Promise<DepositIntent> {
  requireSupabaseConfig();
  if (!apiBaseUrl()) {
    throw new Error("API_NOT_CONFIGURED");
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("AUTH_REQUIRED");
  }
  const response = await fetch(apiUrl("/api/payments/initiate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ bookingId }),
  });
  const payload = await response.json().catch(() => null);
  // A 503 means the gateway is not live yet, but the amount due still comes back — that
  // is information worth showing, not an error to swallow.
  if (!response.ok && !payload?.paymentId) {
    throw new Error(payload?.error ?? "Could not start payment");
  }
  return payload as DepositIntent;
}


// "Did my payment go through?" - asked by the app, answered by the server.
//
// The app needs this and the website does not, because of where a hosted checkout
// returns to. Easypaisa redirects to a URL; on a phone that URL opens in the SYSTEM
// browser, not inside this app, so the app never sees the gateway callback. Without a
// poll it would sit on a spinner forever while the web callback quietly settled the
// payment behind it.
//
// The route this calls runs exactly the same settlement path the gateway callback runs,
// so a payment that completed while a callback was lost still lands here. Nothing in the
// request says what happened - only which booking is being asked about - and RLS decides
// whether this caller may ask at all.
export type PaymentPollState =
  | "none"
  | "not_started"
  | "pending"
  | "paid"
  | "failed"
  // Paid, but the appointment could not be honoured - the hold expired and the slot went
  // (022). Deliberately its own state: telling this customer "confirmed" or "failed"
  // would both be untrue, and they have paid.
  | "review"
  | "unknown";

export type PaymentPollResult = {
  state: PaymentPollState;
  /** The visit code, once there is one to show. */
  reference?: string | null;
  amount?: number;
  currency?: string;
};

export async function pollPaymentStatus(bookingId: string): Promise<PaymentPollResult> {
  requireSupabaseConfig();
  if (!apiBaseUrl()) {
    throw new Error("API_NOT_CONFIGURED");
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(
    apiUrl(`/api/payments/status?bookingId=${encodeURIComponent(bookingId)}`),
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not check the payment");
  }
  return payload as PaymentPollResult;
}

// The receipt for one visit, by its short code.
//
// Straight to Supabase rather than through the web backend: booking_receipt (035) is
// SECURITY DEFINER and authorises the signed-in caller itself, so there is nothing for a
// server route to add except a hop. The same RPC answers the customer and salon staff.
export type ReceiptService = {
  booking_id: string;
  service: string;
  price: number;
  starts_at: string;
  ends_at: string;
  status: string;
  professional: string | null;
};

export type BookingReceipt = {
  reference: string;
  salon: { id: string; name: string; slug: string; timezone: string; currency: string };
  customer: { name: string; phone: string };
  starts_at: string;
  status: string;
  services: ReceiptService[];
  total: number;
  amount_paid: number;
  fully_paid: boolean;
  viewer: "customer" | "salon_admin" | "professional" | "super_admin";
};

export async function fetchBookingReceipt(reference: string): Promise<BookingReceipt> {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc("booking_receipt", {
    p_reference: reference,
  });
  // NOT_AUTHORISED covers both "no such code" and "not yours" - 035 returns the same code
  // for each so it cannot be used to probe, and that property is kept here rather than
  // being unpicked into two different messages on screen.
  if (error) throw new Error(error.message);
  return data as BookingReceipt;
}

/**
 * The visit code for a booking just created.
 *
 * create_customer_booking_group does not return it - the column arrived in 035, after
 * that function was last rewritten, and widening its return type would mean editing a
 * function five migrations have patched in place. One select under the customer's own
 * RLS is the cheaper answer.
 */
export async function fetchBookingReference(bookingId: string): Promise<string | null> {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from("bookings")
    .select("reference")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) return null;
  return (data?.reference as string | null) ?? null;
}

// bookingErrorMessage now lives in utils/bookingErrors.ts.
//
// It was inline here, which welded the only pure product logic in this file to a module
// that imports react-native — so no unit test could reach it, and it had silently fallen
// six codes behind the web client: AUTH_REQUIRED, CUSTOMER_PROFILE_REQUIRED,
// CUSTOMER_CONTACT_REQUIRED, SALON_NOT_BOOKABLE, SERVICE_NOT_BOOKABLE and
// BOOKING_TIME_IN_PAST all fell through to `return message`, which put the raw
// Postgres/PostgREST text on a customer's phone. Re-exported so every existing call site
// is unchanged.
export { bookingErrorMessage } from "@/utils/bookingErrors";
