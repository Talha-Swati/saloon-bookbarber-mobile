# BookBarber Mobile Architecture

BookBarber is an Expo Router mobile application backed by Supabase. The mobile repository owns the React Native UI, navigation, client-side session handling, and typed service boundaries. Supabase owns authentication, database tables, row-level security, SQL functions, and migrations.

## Runtime Stack

- Expo SDK 57 with Expo Router typed routes.
- React Native 0.86 and React 19.
- Supabase JavaScript client with AsyncStorage-backed auth persistence.
- Public mobile environment variables only:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_DEMO_AUTH_BYPASS` for development-only demo auth.

Never put service-role credentials in this app.

## Directory Responsibilities

- `app/`: Expo Router routes and layouts. Files here are screen entry points and must keep Expo Router conventions.
- `components/`: Shared presentational UI used by customer and professional screens.
- `constants/`: Theme and development-only demo auth constants.
- `data/`: Static mock data still used by unfinished demo-only features such as notifications and reviews.
- `providers/`: App-wide React providers, currently authentication/session state.
- `services/`: Backend integration boundaries. Screens call services instead of Supabase directly.
- `types/`: Shared TypeScript models used by screens and services.
- `docs/`: Mobile architecture and SQA notes.

No `frontend/` or `backend/` folders were introduced because moving `app/` would break Expo Router. The conceptual split is `app/components/providers/constants` for mobile UI/application code and `services` for backend integration contracts.

## Routing

Customer routes:

- `/`: role gateway
- `/(tabs)`: customer tab layout
- `/(tabs)`: Home
- `/(tabs)/salons`: salon list
- `/salon/[id]`: salon details
- `/booking`: booking flow
- `/booking-confirmation`: booking confirmation
- `/(tabs)/bookings`: my bookings
- `/booking/[id]`: booking details
- `/review/[bookingId]`: review UI
- `/notifications`: notifications UI
- `/(tabs)/profile`: customer profile and sign-in entry
- `/auth/sign-in`
- `/auth/sign-up`

Professional routes:

- `/professional`: dashboard / today
- `/professional/bookings`: assigned bookings
- `/professional/booking/[id]`: assigned booking details and status actions
- `/professional/profile`: professional profile

## Supabase Integration

`services/supabase.ts` creates one Supabase client using public Expo environment variables. Auth sessions persist in AsyncStorage with refresh enabled.

Customer service boundary:

- `fetchSalons`
- `fetchSalon`
- `fetchAvailability`
- `createBooking`
- `fetchMyBookings`
- `fetchBooking`

Customer booking remains `Salon -> Service -> Capacity -> Slot`. The existing customer booking RPC contract was not changed.

`services/salonService.ts` was fixed 2026-09-11 (previously threw/silently degraded):
`fetchAvailability`, `fetchMyBookings`, `fetchBooking`, and `createBooking` embedded a
`services` relation that doesn't exist (the real table/embed key is `salon_services` —
`bookings.service_id` references `salon_services`, not a table called `services`),
which made every one of those Supabase queries fail outright with a PostgREST
"could not find a relationship" error. Also fixed: `bookings` has no `booking_date`
column (date is derived from `start_time`), the snapshot columns are
`service_price_snapshot`/`duration_minutes_snapshot` (not
`total_amount_snapshot`/`duration_snapshot_minutes`), there is no deposit/payment
system yet so `deposit` is always `0` and `paymentMethod`/`paymentStatus` are fixed
"At salon"/"Pay at salon" strings rather than referencing nonexistent columns, and
`fetchAvailability` now checks the RPC's real `available_capacity` field instead of a
nonexistent `available`/`is_available` field (previously every slot showed as
bookable regardless of remaining capacity).

`fetchAvailability` and `createBooking` were fixed again 2026-09-12
(fix-booking-rpc-2026-09-12): both called their RPCs with a "prefixed" argument set
(e.g. `p_salon_id`, `p_booking_date`) and, on a `PGRST202` "function not found" error,
retried with an unprefixed set (`salon_id`, `booking_date`) — for
`create_customer_booking`, *neither* set matched its real deployed signature
(`p_service_id`, `p_start_time`, `p_notes`, `p_booking_source` — verified against
`saloon-bookbarber-web/supabase/migrations/007_booking_phase1.sql`, unchanged through
`011`; there is no `p_salon_id`/`p_booking_date` parameter, the salon is resolved
server-side from the service), so every real booking attempt failed outright regardless
of which set PostgREST tried. Fixed by calling both RPCs directly with their verified
real argument names and removing the fallback dance (`rpcWithArgs`) entirely — it
existed to guess around an unverified signature, which is what caused this bug.
`get_service_availability`'s "prefixed" set (`p_salon_id`, `p_service_id`,
`p_booking_date`) was actually already correct; only the never-triggered fallback
branch was dead weight.

Professional service boundary:

- `fetchProfessionalProfile(mode)`
- `fetchAssignedBookings(mode)`
- `fetchAssignedBooking(id, mode)`
- `transitionAssignedBookingStatus(input)`

Demo sessions (`EXPO_PUBLIC_DEMO_AUTH_BYPASS`) use local mock professional data. Real
sessions read live data from Supabase: `professionals` (own row via
`professionals_own_select` RLS), `professional_services` + `salon_services` (linked
services), and `bookings` (assigned bookings, scoped by
`bookings_professional_select_assigned` RLS — no client-side filtering by professional
id is needed). Field mapping confirmed against
`saloon-bookbarber-web/supabase/migrations/012_professional_phase1.sql` on 2026-09-09.

Professional status transitions use only:

```ts
supabase.rpc("transition_booking_status", {
  p_booking_id: bookingId,
  p_to_status: targetStatus,
  p_reason: reason ?? null,
});
```

The mobile app must not call `supabase.from("bookings").update(...)` for professional status changes.

Booking-sync session (2026-09-12): `app/professional/index.tsx` and
`app/professional/bookings.tsx` previously only refreshed on `useFocusEffect`
(navigate away and back). Both now also call
`subscribeToAssignedBookings(professionalId, onChange)` while focused — a
`postgres_changes` subscription on `bookings` filtered by `professional_id`,
same pattern as the web repo's
`components/employee/EmployeeNotificationBell.tsx` — so a booking a customer
makes, or a status change made from the salon-admin dashboard, appears
immediately without navigating away and back. RLS
(`bookings_professional_select_assigned`) already scopes this correctly; the
filter is an optimization, not the security boundary.

## Required Backend Contracts Next

- Read authenticated professional profile.
- Read authenticated professional's assigned bookings.
- Read a single assigned booking with customer, service, time, and status information.
- Enforce RLS so professionals can access only their own assigned bookings.
- Support `transition_booking_status` for:
  - `confirmed -> checked_in`
  - `checked_in -> in_service`
  - `in_service -> completed`
  - `confirmed -> no_show`
- Keep professional assignment restricted to authorized Salon Admin/Super Admin contexts through `assign_booking_professional`.

