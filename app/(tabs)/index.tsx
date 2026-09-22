import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { BookingCard } from "@/components/BookingCard";
import { SalonCard } from "@/components/SalonCard";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import {
  Card,
  Chip,
  EmptyState,
  Icon,
  PressableScale,
  SearchBar,
  SkeletonList,
  enterUp,
  listTransition,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { fetchMyBookings, fetchSalons, salonMatchesSearch } from "@/services/salonService";
import { fetchNotifications } from "@/services/notificationService";
import { useAuth } from "@/providers/AuthProvider";
import { Booking, Salon } from "@/types";

const ALL = "__all__";

/** Morning / afternoon / evening, on the device's clock. */
function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** The first name from a Supabase profile, or nothing — never the raw email address. */
function firstName(session: { user?: { user_metadata?: Record<string, unknown> } } | null) {
  const full = session?.user?.user_metadata?.full_name;
  if (typeof full !== "string" || !full.trim()) return "";
  return full.trim().split(/\s+/)[0];
}

export default function Home() {
  const { session: activeSession, role, configured } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [items, setItems] = useState<Salon[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  const load = useCallback(() => {
    setError("");
    return Promise.all([
      fetchSalons(),
      session ? fetchMyBookings() : Promise.resolve([]),
      // Swallowed on purpose: the unread count is a dot on a bell, and losing it must
      // never take the salon list down with it.
      session && configured ? fetchNotifications().catch(() => []) : Promise.resolve([]),
    ])
      .then(([salonRows, bookingRows, notificationRows]) => {
        setItems(salonRows);
        setMyBookings(bookingRows);
        setUnread(notificationRows.filter((row) => !row.read).length);
      })
      .catch(() => setError("We could not load salons. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [configured, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * The next appointment, not an arbitrary one.
   *
   * `fetchMyBookings` returns newest-first, so `bookings.find(upcoming)` — which is what
   * this screen used to do — picked the appointment FURTHEST in the future. A customer
   * with a trim on Thursday and a colour next month was shown next month's.
   */
  const nextBooking = useMemo(
    () =>
      myBookings
        .filter((booking) => booking.status === "upcoming")
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null,
    [myBookings],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          items.flatMap((salon) =>
            salon.services.map((service) => service.category).filter(Boolean),
          ),
        ),
      ).sort() as string[],
    [items],
  );

  /**
   * Search and category are one filter, applied together.
   *
   * The category row used to be decoration — a horizontal strip of scissors emoji that
   * could not be tapped and filtered nothing. A control that looks tappable and is not
   * is worse than no control, because a person who taps it concludes the app is broken.
   */
  const visible = useMemo(
    () =>
      items.filter(
        (salon) =>
          salonMatchesSearch(salon, query) &&
          (category === ALL || salon.services.some((service) => service.category === category)),
      ),
    [category, items, query],
  );

  const filtering = query.trim().length > 0 || category !== ALL;
  const name = firstName(session);

  return (
    <Screen onRefresh={load}>
      <Animated.View entering={enterUp()} style={s.header}>
        <View style={s.headerText}>
          <Text style={s.greeting}>{greeting()}</Text>
          <Text numberOfLines={1} style={s.headline}>
            {name ? `${name}, where are you going today?` : "Find and book a salon"}
          </Text>
        </View>
        <PressableScale
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
          onPress={() => router.push("/notifications")}
          scaleTo={0.9}
          style={s.bell}
        >
          <Icon color={colors.deepGreen} name="bell" size={22} />
          {/* Only when there is something to see. The dot used to be painted on
              unconditionally, so the bell claimed unread notifications forever. */}
          {unread > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          ) : null}
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enterUp(1)}>
        <SearchBar
          onChange={setQuery}
          placeholder="Search salon, area or service"
          value={query}
        />
      </Animated.View>

      {session && nextBooking ? (
        <Animated.View entering={enterUp(2)} layout={listTransition}>
          <SectionHeader
            action="All bookings"
            onAction={() => router.navigate("/(tabs)/bookings")}
            title="Your next appointment"
          />
          <BookingCard booking={nextBooking} variant="hero" />
        </Animated.View>
      ) : null}

      {!session ? (
        <Animated.View entering={enterUp(2)}>
          <Card
            accessibilityLabel="Sign in to book"
            onPress={() => router.push("/auth/sign-in")}
            style={s.signIn}
          >
            <Icon color={colors.deepGreen} name="person" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={s.signInTitle}>Sign in to book</Text>
              <Text style={s.signInBody}>Browse freely — an account is needed to confirm a time.</Text>
            </View>
            <Icon color={colors.muted} name="forward" size={16} />
          </Card>
        </Animated.View>
      ) : null}

      {loading ? (
        <>
          <SectionHeader title="Salons" />
          <SkeletonList count={3} />
        </>
      ) : error ? (
        <EmptyState
          actionLabel="Try again"
          body={error}
          onAction={load}
          title="Nothing loaded"
          tone="error"
        />
      ) : (
        <>
          {categories.length > 0 ? (
            <Animated.View entering={enterUp(3)}>
              <SectionHeader subtitle="Filters the salons below" title="Service type" />
              <ScrollView
                contentContainerStyle={s.chips}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <Chip label="All" onPress={() => setCategory(ALL)} selected={category === ALL} />
                {categories.map((name) => (
                  <Chip
                    icon="scissors"
                    key={name}
                    label={name}
                    onPress={() => setCategory(category === name ? ALL : name)}
                    selected={category === name}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          <SectionHeader
            action={filtering ? undefined : "See all"}
            onAction={filtering ? undefined : () => router.navigate("/(tabs)/salons")}
            subtitle={
              filtering
                ? `${visible.length} salon${visible.length === 1 ? "" : "s"} match`
                : undefined
            }
            title={filtering ? "Results" : "Salons near you"}
          />

          {visible.length ? (
            (filtering ? visible : visible.slice(0, 4)).map((salon, index) => (
              <Animated.View entering={enterUp(index)} key={salon.id} layout={listTransition}>
                <SalonCard salon={salon} />
              </Animated.View>
            ))
          ) : (
            <EmptyState
              actionLabel={filtering ? "Clear filters" : undefined}
              body={
                filtering
                  ? "Try a different service type, or search for a salon by name or area."
                  : "No salon has been approved for your area yet. Pull down to check again."
              }
              icon="salons"
              onAction={
                filtering
                  ? () => {
                      setQuery("");
                      setCategory(ALL);
                    }
                  : undefined
              }
              title={filtering ? "No salons match" : "No salons yet"}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  greeting: { ...type.caption, color: colors.muted },
  headline: { ...type.title, color: colors.text, marginTop: 2 },
  bell: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onDark, fontSize: 9, fontWeight: "800" },
  signIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  signInTitle: { ...type.bodyStrong, color: colors.text },
  signInBody: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: 2 },
  chips: { gap: spacing.sm, paddingRight: spacing.md, paddingBottom: 2 },
});
