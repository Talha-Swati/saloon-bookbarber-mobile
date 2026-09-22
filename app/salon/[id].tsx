import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import {
  AppBar,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  StatusPill,
  enterUp,
  haptics,
  listTransition,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { fetchSalon } from "@/services/salonService";
import { Salon } from "@/types";
import { formatDuration, formatPkr, formatRating, formatReviewCount } from "@/utils/format";

export default function SalonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Order reflects selection order, which is also visit order (services are
  // performed back-to-back in this order — see createBookingGroup).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggle(serviceId: string) {
    haptics.select();
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

  const selected = useMemo(
    () => (salon?.services ?? []).filter((service) => selectedIds.includes(service.id)),
    [salon, selectedIds],
  );
  const total = selected.reduce((sum, service) => sum + service.price, 0);
  const minutes = selected.reduce((sum, service) => sum + service.duration, 0);
  const today = new Date().getDay();

  if (loading) {
    return (
      <Screen>
        <AppBar title="Salon" />
        <View style={s.loading}>
          <Skeleton height={64} style={{ borderRadius: radius.md }} width={64} />
          <Skeleton height={26} width="70%" />
          <Skeleton height={14} width="45%" />
          <Skeleton height={86} style={{ borderRadius: radius.md }} />
          <Skeleton height={86} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  if (error || !salon) {
    return (
      <Screen>
        <AppBar title="Salon" />
        <EmptyState
          actionLabel="Go back"
          body={error || "This salon is no longer listed on BookBarber."}
          onAction={() => router.back()}
          title="Salon not available"
          tone="error"
        />
      </Screen>
    );
  }

  const rating = formatRating(salon.rating);

  return (
    <Screen
      footer={
        // Outside the scroll view, so it is reachable without scrolling back up a menu
        // of twenty services. It only exists once something is selected — an empty bar
        // would be a button that does nothing for the whole first half of the visit.
        selected.length > 0 ? (
          <Animated.View entering={enterUp()} style={s.bar}>
            <View style={{ flex: 1 }}>
              <Text style={s.barMeta}>
                {selected.length} service{selected.length === 1 ? "" : "s"} ·{" "}
                {formatDuration(minutes)}
              </Text>
              <Text style={s.barTotal}>{formatPkr(total)}</Text>
            </View>
            <Button
              block={false}
              label="Choose a time"
              onPress={() =>
                router.push({
                  pathname: "/booking",
                  params: { salonId: salon.id, serviceIds: selectedIds.join(",") },
                })
              }
            />
          </Animated.View>
        ) : null
      }
    >
      <AppBar title={salon.name} />

      <Animated.View entering={enterUp()} style={s.hero}>
        <View style={s.monogram}>
          <Text style={s.initial}>{salon.name[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View style={s.heroText}>
          <Text style={s.name}>{salon.name}</Text>
          <View style={s.metaRow}>
            <Icon color={colors.muted} name="location" size={14} />
            <Text style={s.meta}>{[salon.area, salon.city].filter(Boolean).join(", ")}</Text>
          </View>
          <View style={s.metaRow}>
            {rating ? (
              <>
                <Icon color="#E0A612" name="star" size={14} />
                <Text style={s.rating}>{rating}</Text>
                <Text style={s.meta}>· {formatReviewCount(salon.reviews)}</Text>
              </>
            ) : (
              <Text style={s.meta}>{formatReviewCount(salon.reviews)}</Text>
            )}
          </View>
          <StatusPill
            label={salon.isOpen ? "Taking bookings" : "Not taking bookings"}
            tone={salon.isOpen ? "live" : "stopped"}
          />
        </View>
      </Animated.View>

      <SectionHeader
        subtitle="Pick everything you want in this visit — they are done back to back."
        title="Services"
      />
      {salon.services.length ? (
        salon.services.map((service, index) => {
          const checked = selectedIds.includes(service.id);
          return (
            <Animated.View entering={enterUp(index)} key={service.id} layout={listTransition}>
              <Card
                accessibilityLabel={`${service.name}, ${formatPkr(service.price)}`}
                onPress={() => toggle(service.id)}
                selected={checked}
                style={s.service}
              >
                <View style={s.serviceTop}>
                  <View style={[s.checkbox, checked && s.checkboxOn]}>
                    {checked ? <Icon color={colors.onPrimary} name="check" size={14} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceName}>{service.name}</Text>
                    <Text style={s.serviceMeta}>
                      {formatDuration(service.duration)}
                      {service.category ? ` · ${service.category}` : ""}
                    </Text>
                  </View>
                  <Text style={s.price}>{formatPkr(service.price)}</Text>
                </View>
                {service.description ? (
                  <Text style={s.serviceDescription}>{service.description}</Text>
                ) : null}
              </Card>
            </Animated.View>
          );
        })
      ) : (
        <EmptyState
          body="This salon has not published a price list yet."
          icon="scissors"
          title="No services listed"
        />
      )}

      <SectionHeader title="Opening hours" />
      {salon.openingHours.length ? (
        <Card padded={false}>
          {salon.openingHours.map((day, index) => (
            <View
              key={day.dayOfWeek}
              style={[s.hourRow, index === salon.openingHours.length - 1 && s.lastRow]}
            >
              <Text style={[s.day, day.dayOfWeek === today && s.dayToday]}>
                {day.day}
                {day.dayOfWeek === today ? " · today" : ""}
              </Text>
              <Text style={[s.hourText, day.closed && s.closed]}>{day.text}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <Text style={s.meta}>This salon has not published its opening hours.</Text>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md, marginTop: spacing.md },
  hero: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  monogram: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.deepGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.onDark, fontSize: 30, fontWeight: "800" },
  heroText: { flex: 1, gap: 5 },
  name: { ...type.title, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { ...type.caption, color: colors.muted, flexShrink: 1 },
  rating: { ...type.caption, fontWeight: "800", color: colors.text },
  service: { marginBottom: spacing.sm },
  serviceTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  serviceName: { ...type.bodyStrong, color: colors.text },
  serviceMeta: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: 3 },
  price: { ...type.bodyStrong, color: colors.deepGreen },
  serviceDescription: {
    ...type.caption,
    color: colors.secondaryText,
    marginTop: spacing.sm,
    marginLeft: 40,
  },
  hourRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  day: { ...type.caption, color: colors.secondaryText },
  dayToday: { color: colors.deepGreen, fontWeight: "800" },
  hourText: { ...type.caption, fontWeight: "700", color: colors.text },
  closed: { color: colors.muted, fontWeight: "400" },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  barMeta: { ...type.label, fontWeight: "400", color: colors.muted },
  barTotal: { ...type.title, fontSize: 20, lineHeight: 26, color: colors.text, marginTop: 2 },
});
