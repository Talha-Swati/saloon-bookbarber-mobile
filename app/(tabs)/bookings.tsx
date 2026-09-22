import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { BookingCard } from "@/components/BookingCard";
import { Screen } from "@/components/Screen";
import {
  Button,
  EmptyState,
  Segmented,
  SkeletonList,
  enterUp,
  listTransition,
} from "@/components/ui";
import { colors, spacing, type } from "@/constants/theme";
import { fetchMyBookings, subscribeToMyBookings } from "@/services/salonService";
import { useAuth } from "@/providers/AuthProvider";
import { Booking } from "@/types";

type Tab = Booking["status"];

const EMPTY: Record<Tab, { title: string; body: string }> = {
  upcoming: {
    title: "No appointments booked",
    body: "Pick a salon and a free slot — it takes about a minute.",
  },
  completed: {
    title: "No past visits yet",
    body: "Visits show here once the salon marks them complete, and you can review them.",
  },
  cancelled: {
    title: "Nothing cancelled",
    body: "Bookings you cancel, and appointments you miss, are kept here.",
  },
};

export default function Bookings() {
  const { session: activeSession, role, loading: authLoading } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [active, setActive] = useState<Tab>("upcoming");
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // A demo session has no real user id and nothing to subscribe to.
  const customerId =
    session && "user" in session && session.user && !("kind" in session)
      ? String(session.user.id)
      : null;

  const load = useCallback(() => {
    if (!session) {
      setItems([]);
      return Promise.resolve();
    }
    setError("");
    return fetchMyBookings()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (session) setLoading(true);
      load();
    }, [load, session]),
  );

  // Live, so the salon checking you in — or auto-assignment naming your barber — lands
  // on this screen while the customer is looking at it, instead of waiting for them to
  // navigate away and back. Silent refresh: no spinner, because nothing the customer did
  // caused it.
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const unsubscribe = subscribeToMyBookings(customerId, () => {
      fetchMyBookings()
        .then((rows) => {
          if (!cancelled) setItems(rows);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [customerId]);

  const counts = useMemo(
    () => ({
      upcoming: items.filter((booking) => booking.status === "upcoming").length,
      completed: items.filter((booking) => booking.status === "completed").length,
      cancelled: items.filter((booking) => booking.status === "cancelled").length,
    }),
    [items],
  );

  /**
   * Upcoming is sorted soonest-first; everything else newest-first.
   *
   * `fetchMyBookings` returns one order for all three tabs — newest start_time first —
   * which is right for history and backwards for a plan: it put next month's colour above
   * tomorrow's trim, so the appointment a person most needs to see was at the bottom.
   */
  const visible = useMemo(() => {
    const rows = items.filter((booking) => booking.status === active);
    return rows.sort((a, b) =>
      active === "upcoming"
        ? a.startTime.localeCompare(b.startTime)
        : b.startTime.localeCompare(a.startTime),
    );
  }, [active, items]);

  return (
    <Screen onRefresh={session ? load : undefined}>
      <Animated.View entering={enterUp()}>
        <Text accessibilityRole="header" style={s.title}>
          Bookings
        </Text>
        <Text style={s.sub}>Every appointment you have made, past and upcoming.</Text>
      </Animated.View>

      <Animated.View entering={enterUp(1)} style={s.tabs}>
        <Segmented
          onChange={setActive}
          options={[
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "completed", label: "Past", count: counts.completed },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled },
          ]}
          value={active}
        />
      </Animated.View>

      {authLoading || loading ? (
        <SkeletonList count={3} lines={3} />
      ) : !session ? (
        <EmptyState
          actionLabel="Sign in"
          body="Your appointments are tied to your account, so we need to know who you are."
          icon="person"
          onAction={() => router.push("/auth/sign-in")}
          title="Sign in to see your bookings"
        />
      ) : error ? (
        <EmptyState
          actionLabel="Try again"
          body={error}
          onAction={load}
          title="Could not load your bookings"
          tone="error"
        />
      ) : visible.length ? (
        visible.map((booking, index) => (
          <Animated.View entering={enterUp(index)} key={booking.id} layout={listTransition}>
            <BookingCard booking={booking} />
            {booking.status === "completed" ? (
              <Button
                icon="star"
                label="Leave a review"
                onPress={() =>
                  router.push({
                    pathname: "/review/[bookingId]",
                    params: { bookingId: booking.id },
                  })
                }
                size="md"
                style={s.review}
                variant="secondary"
              />
            ) : null}
          </Animated.View>
        ))
      ) : (
        <EmptyState
          actionLabel={active === "upcoming" ? "Find a salon" : undefined}
          body={EMPTY[active].body}
          icon="bookingsOutline"
          onAction={active === "upcoming" ? () => router.navigate("/(tabs)/salons") : undefined}
          title={EMPTY[active].title}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { ...type.display, color: colors.text },
  sub: { ...type.body, color: colors.muted, marginTop: 6 },
  tabs: { marginTop: spacing.lg, marginBottom: spacing.lg },
  review: { marginTop: -spacing.sm, marginBottom: spacing.md, alignSelf: "stretch" },
});
