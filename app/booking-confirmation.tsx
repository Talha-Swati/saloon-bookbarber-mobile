import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
export default function Confirmation() {
  const p = useLocalSearchParams<{
    id: string;
    salon: string;
    service: string;
    date: string;
    time: string;
    total: string;
    deposit: string;
    remaining: string;
  }>();
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
          <Text style={s.checkText}>?</Text>
        </View>
        <Text style={s.title}>Booking confirmed</Text>
        <Text style={s.subtitle}>Your appointment is reserved.</Text>
        <Text style={s.id}>BOOKING ID · {p.id}</Text>
      </View>
      <View style={s.card}>
        <Row label="Salon" value={p.salon} />
        <Row label="Service" value={p.service} />
        <Row label="Date & time" value={p.date + " · " + p.time} />
        <Row
          label="Total amount"
          value={"PKR " + Number(p.total).toLocaleString()}
        />
        <Row
          label="Booking deposit"
          value={"PKR " + Number(p.deposit).toLocaleString()}
        />
        <Row
          label="Remaining amount"
          value={"PKR " + Number(p.remaining).toLocaleString()}
          last
        />
      </View>
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
