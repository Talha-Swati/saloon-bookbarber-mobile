import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import {
  AppBar,
  Button,
  Card,
  EmptyState,
  Icon,
  Notice,
  PillTone,
  Skeleton,
  StatusPill,
  enterUp,
  haptics,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchAssignedBooking,
  fetchVisitBookings,
  professionalErrorMessage,
  ProfessionalBooking,
  ProfessionalBookingStatus,
  transitionAssignedBookingStatus,
} from "@/services/professionalService";
import { formatDuration, formatPkr } from "@/utils/format";

/**
 * What this barber can do next, and which of those is the normal next step.
 *
 * `primary` is the move the day usually takes — check in, start, complete. Everything
 * else is the exception, and is rendered as a quieter button. The previous version laid
 * "Check In" and "No-show" side by side in the same size, so the single most consequential
 * button in the barber's app (marking a paying customer absent) was one mis-tap away from
 * the one they press twenty times a day.
 */
const NEXT: Record<
  ProfessionalBookingStatus,
  { primary?: { label: string; status: ProfessionalBookingStatus }; secondary?: { label: string; status: ProfessionalBookingStatus } }
> = {
  confirmed: {
    primary: { label: "Customer has arrived", status: "checked_in" },
    secondary: { label: "Mark as no-show", status: "no_show" },
  },
  checked_in: { primary: { label: "Start service", status: "in_service" } },
  in_service: { primary: { label: "Finish and complete", status: "completed" } },
  completed: {},
  pending_payment: {},
  cancelled: {},
  rescheduled: {},
  no_show: {},
};

const TONE: Record<ProfessionalBookingStatus, PillTone> = {
  confirmed: "live",
  checked_in: "live",
  in_service: "live",
  completed: "done",
  no_show: "stopped",
  cancelled: "stopped",
  rescheduled: "stopped",
  pending_payment: "pending",
};

const STAGES: { label: string; reached: ProfessionalBookingStatus[] }[] = [
  { label: "Confirmed", reached: ["confirmed", "checked_in", "in_service", "completed", "no_show"] },
  { label: "Checked in", reached: ["checked_in", "in_service", "completed"] },
  { label: "In the chair", reached: ["in_service", "completed"] },
  { label: "Completed", reached: ["completed"] },
];

export default function ProfessionalBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, isDemo } = useAuth();
  const [booking, setBooking] = useState<ProfessionalBooking | null>(null);
  // The other services the same customer booked in this visit. A multi-service visit is
  // several booking rows (016_multi_service_bookings.sql), so without this a barber
  // finishing the haircut has no way to know a beard trim for the same person follows
  // immediately after, and would call the next customer.
  const [visit, setVisit] = useState<ProfessionalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role !== "professional") {
      router.replace("/professional");
      return;
    }
    if (!id) return;
    setLoading(true);
    setError("");
    const mode = isDemo ? "demo" : "remote";
    let cancelled = false;
    fetchAssignedBooking(id, mode)
      .then(async (next) => {
        if (cancelled) return;
        setBooking(next);
        setVisit(next?.groupId ? await fetchVisitBookings(next.groupId, mode) : []);
      })
      .catch((nextError) => {
        if (!cancelled) setError(professionalErrorMessage(nextError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isDemo, role]);

  const update = async (status: ProfessionalBookingStatus) => {
    if (!booking) return;
    setBusy(true);
    try {
      setBooking(
        await transitionAssignedBookingStatus({
          booking,
          targetStatus: status,
          mode: isDemo ? "demo" : "remote",
        }),
      );
      haptics.success();
    } catch (nextError) {
      haptics.error();
      Alert.alert("Could not update", professionalErrorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  /** No-show ends the appointment and cannot be undone from this screen, so it asks. */
  const confirmNoShow = (status: ProfessionalBookingStatus) => {
    haptics.warn();
    Alert.alert(
      "Mark as no-show?",
      "This closes the appointment and records that the customer did not arrive.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Mark no-show", style: "destructive", onPress: () => update(status) },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <AppBar title="Appointment" />
        <View style={s.loading}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={160} style={{ borderRadius: radius.md }} />
          <Skeleton height={120} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  if (error || !booking) {
    return (
      <Screen>
        <AppBar title="Appointment" />
        <EmptyState
          actionLabel="Back to my appointments"
          body={error || "This appointment is not assigned to you."}
          onAction={() => router.replace("/professional/bookings")}
          title="Appointment not found"
          tone="error"
        />
      </Screen>
    );
  }

  const actions = NEXT[booking.status];
  const restOfVisit = visit.filter((item) => item.id !== booking.id);
  const stopped = booking.status === "cancelled" || booking.status === "no_show";

  return (
    <Screen
      footer={
        actions.primary || actions.secondary ? (
          <View style={s.actions}>
            {actions.primary ? (
              <Button
                label={actions.primary.label}
                loading={busy}
                onPress={() => update(actions.primary!.status)}
              />
            ) : null}
            {actions.secondary ? (
              <Button
                disabled={busy}
                label={actions.secondary.label}
                onPress={() => confirmNoShow(actions.secondary!.status)}
                variant="destructive"
              />
            ) : null}
          </View>
        ) : null
      }
    >
      <AppBar title="Appointment" />

      <Animated.View entering={enterUp()} style={s.hero}>
        <StatusPill label={booking.status.replace(/_/g, " ")} tone={TONE[booking.status]} />
        <Text style={s.customer}>{booking.customerName}</Text>
        <Text style={s.when}>
          {booking.date === "today" ? "Today" : booking.date} · {booking.time} ·{" "}
          {formatDuration(booking.durationMinutes)}
        </Text>
      </Animated.View>

      {/* A tappable number, not a string to copy by hand. A barber needing this is
          usually standing at the chair wondering where someone is. */}
      {booking.customerPhone ? (
        <Animated.View entering={enterUp(1)}>
          <Card
            accessibilityLabel={`Call ${booking.customerName}`}
            onPress={() => Linking.openURL(`tel:${booking.customerPhone}`)}
            style={s.call}
          >
            <View style={s.callIcon}>
              <Icon color={colors.deepGreen} name="phone" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.callLabel}>Call the customer</Text>
              <Text style={s.callNumber}>{booking.customerPhone}</Text>
            </View>
            <Icon color={colors.muted} name="forward" size={16} />
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={enterUp(2)} style={s.card}>
        <Card padded={false}>
          <Row label="Service" value={booking.serviceName} />
          <Row label="Price" last value={formatPkr(booking.price)} />
        </Card>
      </Animated.View>

      {booking.notes ? (
        <>
          <SectionHeader title="Customer note" />
          <Card>
            <Text style={s.note}>{booking.notes}</Text>
          </Card>
        </>
      ) : null}

      {restOfVisit.length > 0 ? (
        <>
          <SectionHeader
            subtitle="Same customer, back to back. Do not call the next person until these are done."
            title="Rest of this visit"
          />
          <Card padded={false}>
            {restOfVisit.map((item, index) => (
              <Row
                key={item.id}
                label={`${item.time} · ${item.serviceName}`}
                last={index === restOfVisit.length - 1}
                value={`${formatDuration(item.durationMinutes)} · ${formatPkr(item.price)}`}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Progress" />
      {stopped ? (
        <Notice
          body={
            booking.status === "no_show"
              ? "This appointment is closed. The slot is not coming back."
              : "The customer cancelled this appointment."
          }
          title={booking.status === "no_show" ? "Marked as a no-show" : "Cancelled"}
          tone="danger"
        />
      ) : (
        <View style={s.timeline}>
          {STAGES.map((stage, index) => {
            const done = stage.reached.includes(booking.status);
            return (
              <View key={stage.label} style={s.stage}>
                <View style={s.rail}>
                  <View style={[s.dot, done && s.dotOn]}>
                    {done ? <Icon color={colors.onPrimary} name="check" size={11} /> : null}
                  </View>
                  {index < STAGES.length - 1 ? <View style={[s.line, done && s.lineOn]} /> : null}
                </View>
                <Text style={[s.stageText, done && s.stageTextOn]}>{stage.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && s.lastRow]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md, marginTop: spacing.md },
  hero: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  customer: { ...type.display, color: colors.text },
  when: { ...type.body, color: colors.muted },
  call: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  callIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  callLabel: { ...type.label, fontWeight: "400", color: colors.muted },
  callNumber: { ...type.bodyStrong, color: colors.text, marginTop: 2 },
  card: { marginTop: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { ...type.caption, color: colors.secondaryText },
  rowValue: { ...type.caption, fontWeight: "700", color: colors.text, flex: 1, textAlign: "right" },
  note: { ...type.body, color: colors.text },
  timeline: { paddingLeft: 2 },
  stage: { flexDirection: "row", gap: spacing.md },
  rail: { alignItems: "center", width: 22 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  line: { width: 2, flex: 1, minHeight: 20, backgroundColor: colors.border },
  lineOn: { backgroundColor: colors.primary },
  stageText: { ...type.caption, color: colors.muted, paddingBottom: spacing.lg },
  stageTextOn: { color: colors.text, fontWeight: "700" },
  actions: { gap: spacing.sm },
});
