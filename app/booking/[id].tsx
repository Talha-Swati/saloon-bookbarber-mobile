import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
const reasons = [
  "Plans changed",
  "Selected wrong time",
  "Found another salon",
  "Other",
];
const dates = ["Sat 5 Sep", "Sun 6 Sep", "Mon 7 Sep"];
const slots = ["11:00 AM", "2:30 PM", "5:00 PM", "7:30 PM"];
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { fetchBooking } from "@/services/salonService";
import { Booking } from "@/types";
export default function BookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    fetchBooking(id)
      .then(setBooking)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  if (loading)
    return (
      <Screen>
        <Header />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  if (error || !booking)
    return (
      <Screen>
        <Header />
        <View style={s.heading}>
          <Text style={s.title}>{error || "Booking not found."}</Text>
          <Text style={s.muted}>
            Only bookings owned by the signed-in customer can be viewed.
          </Text>
        </View>
      </Screen>
    );
  return (
    <Screen>
      <Header />
      <View style={s.heading}>
        <Text style={s.kicker}>BOOKING ID · {booking.id}</Text>
        <Text style={s.title}>{booking.serviceName}</Text>
        <Text style={s.salon}>{booking.salonName}</Text>
        <Text
          style={[
            s.status,
            booking.status === "upcoming"
              ? s.up
              : booking.status === "cancelled"
                ? s.cancelled
                : s.done,
          ]}
        >
          {booking.status.toUpperCase()}
        </Text>
      </View>
      <View style={s.card}>
        <Row label="Date & time" value={booking.date + " · " + booking.time} />
        <Row label="Duration" value={booking.duration + " minutes"} />
        <Row label="Amount" value={"PKR " + booking.price.toLocaleString()} />
        <Row
          label="Deposit"
          value={"PKR " + booking.deposit.toLocaleString()}
        />
        <Row
          label="Remaining"
          value={"PKR " + (booking.price - booking.deposit).toLocaleString()}
        />
        <Row
          label="Payment"
          value={booking.paymentMethod + " · " + booking.paymentStatus}
        />
      </View>
      <Text style={s.section}>Activity</Text>
      <View style={s.timeline}>
        <Event
          title="Booking recorded"
          detail="This booking is protected by your customer account."
        />
        <Event
          title="Appointment scheduled"
          detail={booking.date + " at " + booking.time}
        />
      </View>
      {booking.status === "completed" && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/review/[bookingId]",
              params: { bookingId: booking.id },
            })
          }
          style={s.primary}
        >
          <Text style={s.primaryText}>Leave a review</Text>
        </Pressable>
      )}
    </Screen>
  );
}
function Header() {
  return (
    <View style={s.nav}>
      <Pressable
        accessibilityLabel="Go back"
        hitSlop={4}
        style={s.backButton}
        onPress={() => router.back()}
      >
        <Text style={s.back}>‹</Text>
      </Pressable>
      <Text style={s.navTitle}>Booking details</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.muted}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
function Event({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={s.event}>
      <View style={s.eventDot} />
      <View>
        <Text style={s.eventTitle}>{title}</Text>
        <Text style={s.eventDetail}>{detail}</Text>
      </View>
    </View>
  );
}
function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.choice, selected && s.choiceOn]}>
      <Text style={[s.choiceText, selected && s.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { fontSize: 36, color: colors.text, lineHeight: 40 },
  navTitle: { fontWeight: "700", color: colors.text },
  heading: { marginVertical: spacing.lg },
  kicker: {
    color: colors.deepGreen,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  salon: { color: colors.muted, marginTop: 5 },
  status: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: "800",
  },
  up: { color: colors.deepGreen, backgroundColor: colors.primarySoft },
  done: { color: colors.muted, backgroundColor: colors.neutralSoft },
  cancelled: { color: colors.danger, backgroundColor: colors.dangerSoft },
  notice: {
    backgroundColor: colors.primarySoft,
    color: colors.deepGreen,
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    fontWeight: "700",
  },
  cancelNotice: { backgroundColor: colors.dangerSoft, color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  muted: { color: colors.muted, flexShrink: 1 },
  value: { color: colors.text, fontWeight: "700", flex: 1, textAlign: "right" },
  section: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  timeline: { paddingLeft: 8 },
  event: { flexDirection: "row", gap: 12, paddingBottom: spacing.md },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  eventTitle: { color: colors.text, fontWeight: "700" },
  eventDetail: { color: colors.muted, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  action: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  danger: { backgroundColor: colors.dangerSoft },
  dangerText: { color: colors.danger, fontWeight: "800" },
  outline: { borderWidth: 1, borderColor: colors.primary },
  outlineText: { color: colors.deepGreen, fontWeight: "800" },
  primary: {
    minHeight: 50,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  contact: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,.45)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 48,
    maxHeight: "90%",
  },
  sheetTitle: { fontSize: 23, fontWeight: "800", color: colors.text },
  help: {
    color: colors.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  choiceText: { color: colors.text, fontWeight: "600" },
  choiceTextOn: { color: colors.deepGreen, fontWeight: "800" },
  close: { alignItems: "center", padding: 15 },
});
