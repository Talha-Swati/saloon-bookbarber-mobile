import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BookingCard } from "@/components/BookingCard";
import { SalonCard } from "@/components/SalonCard";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, radius, spacing } from "@/constants/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";
import { fetchMyBookings, fetchSalons } from "@/services/salonService";
import { useAuth } from "@/providers/AuthProvider";
import { Booking, Salon } from "@/types";
export default function Home() {
  const { session: activeSession, role } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [items, setItems] = useState<Salon[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetchSalons(),
      session ? fetchMyBookings() : Promise.resolve([]),
    ])
      .then(([salonRows, bookingRows]) => {
        setItems(salonRows);
        setMyBookings(bookingRows);
      })
      .catch(() => setError("Unable to load salons."))
      .finally(() => setLoading(false));
  }, [session]);
  useFocusEffect(load);
  const visible = items.filter((x) =>
    `${x.name} ${x.area} ${x.services.map((y) => y.name).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const serviceCategories = [
    ...new Set(
      items.flatMap((x) => x.services.map((y) => y.category).filter(Boolean)),
    ),
  ];
  const upcoming = myBookings.find((x) => x.status === "upcoming");
  return (
    <Screen>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>DISCOVER</Text>
          <Text style={s.location}>Active salons</Text>
        </View>
        <Pressable
          accessibilityLabel="Open notifications"
          onPress={() => router.push("/notifications")}
          style={s.avatar}
        >
          <Text style={s.bell}>●</Text>
          <Text style={s.bellIcon}>🔔</Text>
        </Pressable>
      </View>
      <Text style={s.title}>Look sharp. Feel your best.</Text>
      <View style={s.search}>
        <Text style={{ fontSize: 22 }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search salons or services"
          placeholderTextColor={colors.muted}
          style={s.input}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <View style={s.empty}>
          <Text style={s.categoryName}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={s.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {serviceCategories.length > 0 && (
            <>
              <SectionHeader title="Services" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.categories}
              >
                {serviceCategories.map((name) => (
                  <View key={name} style={s.category}>
                    <Text style={{ fontSize: 24 }}>✂️</Text>
                    <Text style={s.categoryName}>{name}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
          {session && (
            <>
              <SectionHeader title="Upcoming booking" />
              {upcoming ? (
                <BookingCard booking={upcoming} />
              ) : (
                <Text style={s.categoryName}>No upcoming booking.</Text>
              )}
            </>
          )}
          <SectionHeader title="Nearby & featured" action="View salons" />
          {visible.length ? (
            visible.slice(0, 3).map((x) => <SalonCard key={x.id} salon={x} />)
          ) : (
            <Text style={s.categoryName}>No salons available yet.</Text>
          )}
        </>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  location: { color: colors.text, fontWeight: "700", marginTop: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.deepGreen, fontWeight: "800" },
  bell: {
    position: "absolute",
    right: 9,
    top: 8,
    color: colors.primary,
    fontSize: 9,
  },
  bellIcon: { color: colors.deepGreen, fontSize: 24, fontWeight: "800" },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "800",
    maxWidth: 300,
    marginBottom: spacing.md,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  input: { flex: 1, minHeight: 52, color: colors.text },
  categories: { gap: 10, paddingBottom: spacing.lg },
  category: {
    minWidth: 84,
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  categoryName: { color: colors.text, fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", padding: spacing.xl },
  retry: { color: colors.deepGreen, fontWeight: "800", marginTop: spacing.md },
});
