import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import {
  AppBar,
  Card,
  EmptyState,
  PillTone,
  Segmented,
  SkeletonList,
  StatusPill,
  enterUp,
  listTransition,
} from "@/components/ui";
import { colors, spacing, type } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchAssignedBookings,
  fetchProfessionalProfile,
  professionalErrorMessage,
  subscribeToAssignedBookings,
  ProfessionalBooking,
} from "@/services/professionalService";
import { formatDuration, formatPkr } from "@/utils/format";

type Filter = "today" | "upcoming" | "completed";

const TONE: Record<ProfessionalBooking["status"], PillTone> = {
  confirmed: "live",
  checked_in: "live",
  in_service: "live",
  completed: "done",
  no_show: "stopped",
  cancelled: "stopped",
  rescheduled: "stopped",
  pending_payment: "pending",
};

export default function ProfessionalBookings() {
  const { role, isDemo } = useAuth();
  const [active, setActive] = useState<Filter>("today");
  const [items, setItems] = useState<ProfessionalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (role !== "professional") {
        router.replace("/professional");
        return;
      }
      setLoading(true);
      setError("");
      const mode = isDemo ? "demo" : "remote";
      let cancelled = false;
      let unsubscribe: (() => void) | undefined;
      fetchAssignedBookings(mode)
        .then((nextItems) => {
          if (cancelled) return;
          setItems(nextItems);
          // Same live-refresh subscription as app/professional/index.tsx, scoped to
          // this screen's focus lifetime — see services/professionalService.ts.
          if (!isDemo) {
            fetchProfessionalProfile(mode).then((prof) => {
              if (cancelled) return;
              unsubscribe = subscribeToAssignedBookings(prof.id, () => {
                fetchAssignedBookings(mode).then((refreshed) => {
                  if (!cancelled) setItems(refreshed);
                });
              });
            });
          }
        })
        .catch((nextError) => {
          if (!cancelled) setError(professionalErrorMessage(nextError));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }, [isDemo, role]),
  );

  const refresh = useCallback(
    () =>
      fetchAssignedBookings(isDemo ? "demo" : "remote")
        .then(setItems)
        .catch((nextError) => setError(professionalErrorMessage(nextError))),
    [isDemo],
  );

  // "Upcoming" means work still to do on another day. Cancelled and rescheduled
  // bookings are neither upcoming nor completed, so they no longer pad the middle tab.
  const matches = useCallback(
    (item: ProfessionalBooking, filter: Filter) =>
      filter === "today"
        ? item.date === "today"
        : filter === "completed"
          ? item.status === "completed" || item.status === "no_show"
          : item.date !== "today" &&
            (item.status === "confirmed" ||
              item.status === "checked_in" ||
              item.status === "in_service"),
    [],
  );

  const counts = useMemo(
    () => ({
      today: items.filter((item) => matches(item, "today")).length,
      upcoming: items.filter((item) => matches(item, "upcoming")).length,
      completed: items.filter((item) => matches(item, "completed")).length,
    }),
    [items, matches],
  );

  const filtered = items.filter((item) => matches(item, active));

  return (
    <Screen onRefresh={refresh}>
      <AppBar title="My appointments" />

      <Animated.View entering={enterUp()} style={s.tabs}>
        <Segmented
          onChange={setActive}
          options={[
            { value: "today", label: "Today", count: counts.today },
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "completed", label: "Done", count: counts.completed },
          ]}
          value={active}
        />
      </Animated.View>

      {loading ? (
        <SkeletonList count={4} lines={2} />
      ) : error ? (
        <EmptyState
          actionLabel="Try again"
          body={error}
          onAction={refresh}
          title="Appointments did not load"
          tone="error"
        />
      ) : filtered.length ? (
        filtered.map((item, index) => (
          <Animated.View entering={enterUp(index)} key={item.id} layout={listTransition}>
            <Card
              accessibilityLabel={`${item.customerName}, ${item.serviceName}, ${item.time}`}
              onPress={() =>
                router.push({ pathname: "/professional/booking/[id]", params: { id: item.id } })
              }
              style={s.card}
            >
              <View style={s.top}>
                <Text numberOfLines={1} style={s.name}>
                  {item.customerName}
                </Text>
                <StatusPill label={item.status.replace(/_/g, " ")} tone={TONE[item.status]} />
              </View>
              <Text style={s.service}>{item.serviceName}</Text>
              <View style={s.metaRow}>
                <Text style={s.meta}>
                  {item.date === "today" ? "Today" : item.date} · {item.time} ·{" "}
                  {formatDuration(item.durationMinutes)}
                </Text>
                <Text style={s.price}>{formatPkr(item.price)}</Text>
              </View>
            </Card>
          </Animated.View>
        ))
      ) : (
        <EmptyState
          body={
            active === "today"
              ? "Nothing is booked with you today."
              : active === "upcoming"
                ? "No appointments booked with you on other days yet."
                : "Appointments move here once you complete them, or mark a no-show."
          }
          icon="calendar"
          title="Nothing here"
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  tabs: { marginTop: spacing.md, marginBottom: spacing.lg },
  card: { marginBottom: spacing.sm, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { ...type.cardTitle, color: colors.text, flex: 1 },
  service: { ...type.body, color: colors.secondaryText },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 2,
  },
  meta: { ...type.label, fontWeight: "400", color: colors.muted, flexShrink: 1 },
  price: { ...type.label, color: colors.text },
});
