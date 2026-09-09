import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, radius, spacing } from "@/constants/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { fetchSalon } from "@/services/salonService";
import { Salon } from "@/types";
export default function SalonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSalon(id)
      .then(setSalon)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  if (loading)
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  if (error || !salon)
    return (
      <Screen>
        <Pressable onPress={() => router.back()}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <Text style={s.title}>{error || "Salon not found."}</Text>
      </Screen>
    );
  return (
    <Screen>
      <View style={[s.cover, { backgroundColor: salon.accent }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <Text style={s.mono}>{salon.name[0]}</Text>
      </View>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{salon.name}</Text>
          <Text style={s.location}>
            {salon.area}, {salon.city}
          </Text>
        </View>
        <Text style={[s.status, salon.isOpen ? s.open : s.closed]}>
          {salon.isOpen ? "ACTIVE" : "CLOSED"}
        </Text>
      </View>
      <Text style={s.rating}>
        ? {salon.rating} <Text style={s.muted}>({salon.reviews} reviews)</Text>
      </Text>
      <Text style={s.description}>{salon.description}</Text>
      <SectionHeader title="Services" />
      {salon.services.length ? (
        salon.services.map((service) => (
          <View key={service.id} style={s.card}>
            <View style={s.serviceTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.serviceName}>{service.name}</Text>
                <Text style={s.duration}>
                  {service.duration} min
                  {service.category ? ` · ${service.category}` : ""}
                </Text>
              </View>
              <Text style={s.price}>PKR {service.price.toLocaleString()}</Text>
            </View>
            <Text style={s.serviceDescription}>{service.description}</Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/booking",
                  params: { salonId: salon.id, serviceId: service.id },
                })
              }
              style={s.book}
            >
              <Text style={s.bookText}>Book</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={s.muted}>No active services are available.</Text>
      )}
      <SectionHeader title="Opening hours" />
      <View style={s.hours}>
        <Text style={s.serviceName}>Hours</Text>
        <Text style={[s.muted, { flex: 1, textAlign: "right" }]}>
          {salon.hours}
        </Text>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  cover: {
    height: 190,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  mono: { fontSize: 68, color: colors.onPrimary, fontWeight: "800" },
  back: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 34, color: colors.text, lineHeight: 38 },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { fontSize: 27, fontWeight: "800", color: colors.text },
  location: { color: colors.muted, marginTop: 5 },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: "800",
  },
  open: { color: colors.deepGreen, backgroundColor: colors.primarySoft },
  closed: { color: colors.danger, backgroundColor: colors.dangerSoft },
  rating: { color: colors.warning, fontWeight: "700", marginTop: spacing.sm },
  muted: { color: colors.muted, fontWeight: "400" },
  description: {
    color: colors.muted,
    lineHeight: 21,
    marginVertical: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  serviceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  serviceName: { color: colors.text, fontWeight: "700", fontSize: 15 },
  duration: { color: colors.muted, fontSize: 12, marginTop: 4 },
  price: { color: colors.deepGreen, fontWeight: "800" },
  serviceDescription: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  book: {
    minHeight: 44,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  bookText: { color: colors.onPrimary, fontWeight: "800" },
  review: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  hours: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
});
