import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { Button, Card, Notice, SuccessMark, enterUp } from "@/components/ui";
import { colors, spacing, type } from "@/constants/theme";
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
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)");
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <Screen
      footer={
        <View style={s.actions}>
          <Button label="View my booking" onPress={() => router.replace("/(tabs)/bookings")} />
          <Button label="Back to home" onPress={() => router.replace("/(tabs)")} variant="ghost" />
        </View>
      }
    >
      <View style={s.success}>
        <SuccessMark />
        <Animated.Text entering={enterUp(1)} style={s.title}>
          {awaitingServerPayment ? "Booking reserved" : "You are booked in"}
        </Animated.Text>
        <Animated.Text entering={enterUp(2)} style={s.subtitle}>
          {awaitingServerPayment
            ? `${p.salon} is holding your slot while payment is confirmed.`
            : `${p.salon} has your appointment, and a barber has been assigned.`}
        </Animated.Text>
      </View>

      <Animated.View entering={enterUp(3)}>
        <Card padded={false}>
          {items.map((item, index) => (
            <Row
              key={item.id}
              label={item.serviceName}
              last={index === items.length - 1 && !paid}
              value={`${formatClockTime(item.startTime)} · ${formatPkr(item.price)}`}
            />
          ))}
          <Row emphasis label="Total" last={!paid} value={formatPkr(Number(p.total || 0))} />
          {paid ? (
            <Row
              label={`Paid with Easypaisa${p.paymentAccount ? ` · ${p.paymentAccount}` : ""}`}
              last
              value={p.paymentReference}
            />
          ) : null}
        </Card>
      </Animated.View>

      {paid && PAYMENT_TEST_MODE ? (
        <View style={s.notice}>
          <Notice
            body="Easypaisa is not connected yet, so nothing was charged and the reference above is not a real transaction. Settle the amount at the salon."
            title="Test mode — no real payment"
            tone="warning"
          />
        </View>
      ) : null}

      {awaitingServerPayment ? (
        <View style={s.notice}>
          <Notice
            body="Show the reference above when you arrive."
            title="The salon still has this booking as awaiting payment"
            tone="info"
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Row({
  label,
  value,
  last,
  emphasis,
}: {
  label: string;
  value?: string;
  last?: boolean;
  emphasis?: boolean;
}) {
  return (
    <View style={[s.row, last && s.lastRow]}>
      <Text style={[s.label, emphasis && s.labelStrong]}>{label}</Text>
      <Text style={[s.value, emphasis && s.valueStrong]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  success: { alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...type.display, color: colors.text, marginTop: spacing.md, textAlign: "center" },
  subtitle: {
    ...type.body,
    color: colors.secondaryText,
    marginTop: spacing.sm,
    textAlign: "center",
    maxWidth: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { ...type.caption, color: colors.secondaryText, flexShrink: 1 },
  labelStrong: { ...type.bodyStrong, color: colors.text },
  value: { ...type.caption, fontWeight: "700", color: colors.text, textAlign: "right" },
  valueStrong: { ...type.bodyStrong, color: colors.text },
  notice: { marginTop: spacing.lg },
  actions: { gap: spacing.sm },
});
