import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, radius, spacing } from "@/constants/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { fetchSalon } from "@/services/salonService";
import { Salon } from "@/types";
import { formatPkr, formatRating, formatReviewCount } from "@/utils/format";
export default function SalonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Order reflects selection order, which is also visit order (services are
  // performed back-to-back in this order — see createBookingGroup).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  function toggle(serviceId: string) {
    setSelectedIds((prev) =>
      prev.includes(serviceId) ? prev.filter((x) => x !== serviceId) : [...prev, serviceId],
    );
  }
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
      <View style={s.cover}>
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
      {formatRating(salon.rating) ? (
        <Text style={s.rating}>
          ★ {formatRating(salon.rating)}{" "}
          <Text style={s.muted}>({formatReviewCount(salon.reviews)})</Text>
        </Text>
      ) : (
        <Text style={[s.rating, s.muted]}>{formatReviewCount(salon.reviews)}</Text>
      )}
      {salon.description ? <Text style={s.description}>{salon.description}</Text> : null}
      <SectionHeader title="Services" />
      <Text style={s.hint}>Select one or more services for this visit.</Text>
      {salon.services.length ? (
        salon.services.map((service) => {
          const checked = selectedIds.includes(service.id);
          return (
            <Pressable
              key={service.id}
              onPress={() => toggle(service.id)}
              style={[s.card, checked && s.cardOn]}
            >
              <View style={s.serviceTop}>
                <View style={s.checkRow}>
                  <View style={[s.checkbox, checked && s.checkboxOn]}>
                    {checked && <Text style={s.checkMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceName}>{service.name}</Text>
                    <Text style={s.duration}>
                      {service.duration} min
                      {service.category ? ` · ${service.category}` : ""}
                    </Text>
                  </View>
                </View>
                <Text style={s.price}>{formatPkr(service.price)}</Text>
              </View>
              <Text style={s.serviceDescription}>{service.description}</Text>
            </Pressable>
          );
        })
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
      {selectedIds.length > 0 && (
        <View style={s.stickyBar}>
          <View>
            <Text style={s.stickyCount}>
              {selectedIds.length} service{selectedIds.length === 1 ? "" : "s"}
            </Text>
            <Text style={s.stickyTotal}>
              {formatPkr(
                salon.services
                  .filter((x) => selectedIds.includes(x.id))
                  .reduce((sum, x) => sum + x.price, 0),
              )}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/booking",
                params: { salonId: salon.id, serviceIds: selectedIds.join(",") },
              })
            }
            style={s.continueButton}
          >
            <Text style={s.bookText}>Continue</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  cover: {
    backgroundColor: colors.deepGreen,
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
  hint: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  serviceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontWeight: "800", fontSize: 13 },
  serviceName: { color: colors.text, fontWeight: "700", fontSize: 15 },
  duration: { color: colors.muted, fontSize: 12, marginTop: 4 },
  price: { color: colors.deepGreen, fontWeight: "800" },
  serviceDescription: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  bookText: { color: colors.onPrimary, fontWeight: "800" },
  stickyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  stickyCount: { color: colors.muted, fontSize: 12 },
  stickyTotal: { color: colors.text, fontWeight: "800", fontSize: 17, marginTop: 2 },
  continueButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
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
