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
import {
  bookingErrorMessage,
  cancelBooking,
  fetchBooking,
  fetchBookingPayments,
  startDepositPayment,
} from "@/services/salonService";
import { Booking, BookingPayment } from "@/types";
import { formatDateLabel, formatDuration, formatPkr, relativeDayLabel } from "@/utils/format";

/**
 * The stages a booking passes through, in order, so the screen can show where this one
 * has got to.
 *
 * What this replaces was two hardcoded rows — "Booking recorded / This booking is
 * protected by your customer account" and "Appointment scheduled" — printed identically
 * on every booking regardless of its state. They were a timeline in appearance only:
 * they never changed, so they told a customer standing in the salon nothing about
 * whether the salon had checked them in.
 */
const STAGES = ["Confirmed", "Checked in", "In progress", "Completed"] as const;
const STAGE_FOR_LABEL: Record<string, number> = {
  "Awaiting payment": 0,
  Confirmed: 1,
  "Checked in": 2,
  "In progress": 3,
  Completed: 4,
};

const toneFor = (booking: Booking): PillTone => {
  if (booking.statusLabel === "Awaiting payment") return "pending";
  if (booking.status === "upcoming") return "live";
  if (booking.status === "completed") return "done";
  return "stopped";
};

export default function BookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<BookingPayment | null>(null);
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [depositMessage, setDepositMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");

  // Starts (or resumes) the deposit payment. The amount comes back from the server and
  // is never sent by this screen; repeat taps are safe because the underlying RPC
  // returns the booking's existing open payment rather than opening a second one.
  const payDeposit = async () => {
    if (payingDeposit) return;
    setPayingDeposit(true);
    setDepositMessage("");
    try {
      const intent = await startDepositPayment(id);
      setPayment((prev) =>
        prev
          ? { ...prev, amount: intent.amount, currency: intent.currency, status: intent.status }
          : prev,
      );
      if (!intent.providerReady) {
        setDepositMessage(intent.error ?? "Online payment is not available yet.");
      } else if (intent.redirect?.url) {
        await Linking.openURL(intent.redirect.url);
      }
    } catch (e) {
      setDepositMessage(bookingErrorMessage(e));
    } finally {
      setPayingDeposit(false);
    }
  };

  // Eligibility is the server's call (transition_booking_status rejects anything else
  // with INVALID_STATUS_TRANSITION); `cancelling` also guards a double submit.
  const confirmCancel = () => {
    if (!booking || cancelling) return;
    haptics.warn();
    Alert.alert("Cancel this booking?", "Your slot is released and this cannot be undone.", [
      { text: "Keep booking", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          setActionError("");
          try {
            await cancelBooking(booking.id);
            setBooking(await fetchBooking(booking.id));
          } catch (e) {
            setActionError(bookingErrorMessage(e));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (!id) return;
    fetchBooking(id)
      .then(setBooking)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // The deposit figure is read from the payments row the server created — it is never
    // computed on the device. RLS scopes this to the signed-in customer's own payments.
    // A booking with no deposit simply has no payment row, and nothing is shown.
    fetchBookingPayments(id)
      .then((rows) => setPayment(rows[0] ?? null))
      .catch(() => setPayment(null));
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <AppBar title="Booking" />
        <View style={s.loading}>
          <Skeleton height={26} width="70%" />
          <Skeleton height={14} width="45%" />
          <Skeleton height={150} style={{ borderRadius: radius.md }} />
          <Skeleton height={110} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  if (error || !booking) {
    return (
      <Screen>
        <AppBar title="Booking" />
        <EmptyState
          actionLabel="Back to my bookings"
          body={error || "Only bookings made with your own account can be opened here."}
          onAction={() => router.replace("/(tabs)/bookings")}
          title="Booking not found"
          tone="error"
        />
      </Screen>
    );
  }

  const reached = STAGE_FOR_LABEL[booking.statusLabel] ?? 0;
  const stopped = booking.status === "cancelled";

  return (
    <Screen
      footer={
        booking.canCancel || booking.status === "completed" ? (
          <View style={s.actions}>
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
              />
            ) : null}
            {booking.canCancel ? (
              <Button
                label="Cancel booking"
                loading={cancelling}
                onPress={confirmCancel}
                variant="destructive"
              />
            ) : null}
          </View>
        ) : null
      }
    >
      <AppBar title="Booking" />

      <Animated.View entering={enterUp()} style={s.hero}>
        <StatusPill label={booking.statusLabel} tone={toneFor(booking)} />
        <Text style={s.when}>
          {relativeDayLabel(booking.startTime)} · {booking.time}
        </Text>
        <Text style={s.date}>{formatDateLabel(booking.startTime)}</Text>
      </Animated.View>

      <Animated.View entering={enterUp(1)}>
        <Card padded={false}>
          <Row label="Salon" value={booking.salonName} />
          <Row label="Service" value={booking.serviceName} />
          <Row label="Barber" value={booking.professionalName ?? "Assigned by the salon"} />
          <Row label="Length" value={formatDuration(booking.duration)} />
          <Row label="You pay" value={formatPkr(booking.price)} />
          {/* One payment line, not three. `deposit` is hardcoded to 0 until the gateway
              is attached, so "Deposit PKR 0" and a "Remaining" row that simply repeated
              the price were two rows of noise on every booking in the app. */}
          <Row label="Payment" last value={booking.paymentStatus} />
        </Card>
      </Animated.View>

      {payment && payment.status !== "paid" ? (
        <>
          <SectionHeader title="Deposit" />
          <Card padded={false}>
            <Row label="Due now" value={`${payment.currency} ${payment.amount.toLocaleString()}`} />
            <Row label="Balance at the salon" last value={formatPkr(booking.price - payment.amount)} />
          </Card>
          <Text style={s.note}>
            {depositMessage || "Only the deposit is paid online. The balance is settled at the salon."}
          </Text>
          <Button
            label="Pay deposit"
            loading={payingDeposit}
            onPress={payDeposit}
            style={s.deposit}
          />
        </>
      ) : null}

      <SectionHeader title="Progress" />
      {stopped ? (
        <Notice
          body={
            booking.statusLabel === "Missed"
              ? "You did not arrive for this appointment, so the salon closed it."
              : "This booking was cancelled and the slot has been released."
          }
          title={booking.statusLabel}
          tone="danger"
        />
      ) : (
        <View style={s.timeline}>
          {STAGES.map((stage, index) => {
            const done = index < reached;
            const current = index === reached - 1;
            return (
              <View key={stage} style={s.stage}>
                <View style={s.rail}>
                  <View style={[s.dot, done && s.dotOn, current && s.dotNow]}>
                    {done ? <Icon color={colors.onPrimary} name="check" size={11} /> : null}
                  </View>
                  {index < STAGES.length - 1 ? <View style={[s.line, done && s.lineOn]} /> : null}
                </View>
                <Text style={[s.stageText, done && s.stageTextOn]}>{stage}</Text>
              </View>
            );
          })}
        </View>
      )}

      {actionError ? (
        <View style={s.note}>
          <Notice body={actionError} title="That did not work" tone="danger" />
        </View>
      ) : null}
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
  when: { ...type.display, color: colors.text },
  date: { ...type.body, color: colors.muted },
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
  note: { ...type.label, fontWeight: "400", color: colors.muted, lineHeight: 18, marginTop: spacing.md },
  deposit: { marginTop: spacing.md },
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
  dotNow: { borderColor: colors.deepGreen },
  line: { width: 2, flex: 1, minHeight: 22, backgroundColor: colors.border },
  lineOn: { backgroundColor: colors.primary },
  stageText: { ...type.caption, color: colors.muted, paddingBottom: spacing.lg },
  stageTextOn: { color: colors.text, fontWeight: "700" },
  actions: { gap: spacing.sm },
});
