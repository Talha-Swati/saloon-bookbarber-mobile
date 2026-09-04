# Stabilization And SQA Notes

## Commands

- TypeScript: `npx tsc --noEmit`
- Expo Doctor: `npx expo-doctor`
- Web smoke build: `npx expo export --platform web --output-dir dist-smoke`
- Start app: `npm run start`
- Android: `npm run android`
- iOS: `npm run ios`
- Web: `npm run web`

## Manual Smoke Coverage

Customer flow:

1. Sign in or use customer demo when enabled.
2. Open salon discovery.
3. Open salon details.
4. Select a service.
5. Load availability.
6. Select a slot.
7. Create booking.
8. Confirm booking.
9. Open My Bookings.
10. Open booking details.

Professional flow:

1. Sign in or use professional demo when enabled.
2. Open `/professional`.
3. Open assigned bookings.
4. Open assigned booking details.
5. Run allowed status transitions:
   - `confirmed -> checked_in`
   - `checked_in -> in_service`
   - `in_service -> completed`
   - `confirmed -> no_show`
6. Reload the screen and confirm the state remains correct.

## Security/RLS Verification Needed Against Supabase

These checks require real seeded users and deployed migration 012 contracts:

- Professional A cannot read Professional B's bookings.
- Professional cannot assign or unassign professionals.
- Professional cannot modify arbitrary bookings.
- Professional cannot access unrelated salon or admin data.
- Customer cannot access professional-only data.
- Customer cannot modify another customer's booking.
- Invalid transitions are rejected by `transition_booking_status`.
- Cross-salon or inactive professional assignment returns `PROFESSIONAL_NOT_AVAILABLE_FOR_SALON`.

## Current Known Limits

- Notifications and reviews still use local mock data.
- Professional read APIs are intentionally disabled for real sessions until migration 012 fields are confirmed.
- Physical Android device and emulator testing require a connected device outside this repository.

