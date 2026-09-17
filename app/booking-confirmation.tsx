import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import type { CreatedBookingItem } from "@/services/salonService";
import { PAYMENT_TEST_MODE } from "@/services/dummyPayment";
import { formatClockTime, formatPkr } from "@/utils/format";
export default function Confirmation() {
  const p = useLocalSearchParams<{
    salon: string;
    items: string;
    total: string;
    paymentReference?: string;
    paymentAccount?: string;
  }>();
  let items: CreatedBookingItem[] = [];
  try {
    items = JSON.parse(p.items ?? "[]");
  } catch {
    items = [];
  }
  // Two separate facts, deliberately not merged.
  //
  // `paid` is what happened in the app: the customer went through the payment step and
  // it cleared. `awaitingServerPayment` is what the DATABASE thinks — the server decides
  // whether a booking starts unpaid (booking_initial_status, 021), and it has no idea
  // the app's test-mode payment happened, because nothing was recorded against the
  // payments table. Showing only one of these would hide the mismatch that exists while
  // the real gateway is not attached.
  const paid = Boolean(p.paymentReference);
  const awaitingServerPayment = items.some((x) => x.status === "pending_payment");
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.replace("/(tabs)");
        return true;
      },
    );
    return () => subscription.remove();
  }, []);
  return (
    <Screen>
      <View style={s.success}>
        <View style={s.check}>
          <Text style={s.checkText}>✓</Text>
        </View>
        <Text style={s.title}>
          {awaitingServerPayment ? "Booking reserved" : "Booking confirmed"}
        </Text>
        <Text style={s.subtitle}>
          {awaitingServerPayment
            ? "Your slot is held while the salon confirms payment."
            : "Your appointment is reserved and a barber has been assigned."}
        </Text>
        <Text style={s.id}>{p.salon}</Text>
      </View>
      <View style={s.card}>
        {items.map((item) => (
          <Row
            key={item.id}
            label={item.serviceName}
            value={`${formatClockTime(item.startTime)} · ${formatPkr(item.price)}`}
          />
        ))}
        <Row label="Total" value={formatPkr(Number(p.total || 0))} last={!paid} />
        {paid && (
          <Row
            label={`Paid with Easypaisa${p.paymentAccount ? ` · ${p.paymentAccount}` : ""}`}
            value={p.paymentReference}
            last
          />
        )}
      </View>
      {paid && PAYMENT_TEST_MODE && (
        <View style={s.testBanner}>
          <Text style={s.testBannerTitle}>TEST MODE — NO REAL PAYMENT</Text>
          <Text style={s.testBannerBody}>
            Easypaisa is not connected yet, so nothing was charged and the
            reference above is not a real transaction. Settle the amount at the
            salon.
          </Text>
        </View>
      )}
      {awaitingServerPayment && (
        <Text style={s.note}>
          The salon still has this booking marked as awaiting payment. Show the
          reference above when you arrive.
        </Text>
      )}
      <Pressable
        onPress={() => router.replace("/(tabs)/bookings")}
        style={s.primary}
      >
        <Text style={s.primaryText}>View My Bookings</Text>
      </Pressable>
      <Pressable onPress={() => router.replace("/(tabs)")} style={s.secondary}>
        <Text style={s.secondaryText}>Back to Home</Text>
      </Pressable>
    </Screen>
  );
}
function Row({
  label,
  value,
  last,
}: {
  label: string;
  value?: string;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  testBanner: {
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  testBannerTitle: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  testBannerBody: {
    color: "#92400E",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  success: { alignItems: "center", paddingVertical: spacing.xl },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  checkText: { fontSize: 36, color: colors.deepGreen, fontWeight: "800" },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: { color: colors.muted, marginTop: 6 },
  id: {
    color: colors.deepGreen,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 12, marginBottom: 5 },
  value: { color: colors.text, fontWeight: "700", flexShrink: 1 },
  primary: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  secondary: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  secondaryText: { color: colors.deepGreen, fontWeight: "800" },
});
