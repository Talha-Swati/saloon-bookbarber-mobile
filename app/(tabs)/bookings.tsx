import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BookingCard } from "@/components/BookingCard";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/constants/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { fetchMyBookings, subscribeToMyBookings } from "@/services/salonService";
import { useAuth } from "@/providers/AuthProvider";
import { Booking } from "@/types";
import { radius } from "@/constants/theme";
const bookingTabs: Booking["status"][] = ["upcoming", "completed", "cancelled"];
export default function Bookings() {
  const { session: activeSession, role, loading: authLoading } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [active, setActive] = useState<Booking["status"]>("upcoming");
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
      return;
    }
    setLoading(true);
    setError("");
    fetchMyBookings()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);
  useFocusEffect(load);

  // Live, so the salon checking you in — or auto-assignment naming your barber — lands
  // on this screen while the customer is looking at it, instead of waiting for them to
  // navigate away and back. Silent refresh: no spinner, because nothing the customer did
  // caused it.
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const unsubscribe = subscribeToMyBookings(customerId, () => {
      fetchMyBookings()
        .then((rows) => { if (!cancelled) setItems(rows); })
        .catch(() => {});
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [customerId]);
  const visible = items.filter((x) => x.status === active);
  return (
    <Screen>
      <Text style={s.title}>My bookings</Text>
      <Text style={s.sub}>Your upcoming and previous salon visits.</Text>
      <View style={s.tabs}>
        {bookingTabs.map((x) => (
          <Pressable
            key={x}
            onPress={() => setActive(x)}
            style={[s.tab, active === x && s.tabOn]}
          >
            <Text style={[s.tabText, active === x && s.tabTextOn]}>
              {x[0].toUpperCase() + x.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {authLoading || loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !session ? (
        <Text style={s.state}>Sign in from Profile to view your bookings.</Text>
      ) : error ? (
        <Text style={s.state}>{error}</Text>
      ) : visible.length ? (
        visible.map((x) => (
          <View key={x.id}>
            <BookingCard booking={x} />
            {x.status === "completed" && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/review/[bookingId]",
                    params: { bookingId: x.id },
                  })
                }
                style={s.review}
              >
                <Text style={s.reviewText}>Leave a review</Text>
              </Pressable>
            )}
          </View>
        ))
      ) : (
        <Text style={s.state}>No {active} bookings.</Text>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  sub: { color: colors.muted, marginTop: 6, marginBottom: spacing.lg },
  tabs: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  tab: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  tabTextOn: { color: colors.deepGreen },
  state: { color: colors.muted, textAlign: "center", padding: spacing.xl },
  review: {
    alignSelf: "flex-end",
    marginTop: -8,
    marginBottom: spacing.lg,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  reviewText: { color: colors.deepGreen, fontWeight: "800" },
});
