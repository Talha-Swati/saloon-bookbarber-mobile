import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { ActivityIndicator, Alert } from "react-native";
import { AvailabilitySlot, Salon, Service } from "@/types";
import {
  bookingErrorMessage,
  createBookingGroup,
  fetchAvailability,
  fetchSalon,
} from "@/services/salonService";
import { useAuth } from "@/providers/AuthProvider";
const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i + 1);
  return {
    value: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  };
});
export default function BookingFlow() {
  const p = useLocalSearchParams<{ salonId: string; serviceIds: string }>();
  const { session: activeSession, role } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(dates[0].value);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotLoading, setSlotLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const serviceIds = (p.serviceIds ?? "").split(",").filter(Boolean);
  useEffect(() => {
    if (!p.salonId) return;
    fetchSalon(p.salonId)
      .then(setSalon)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [p.salonId]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 1) {
          setStep((value) => value - 1);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [step]);
  // Order reflects the order services were selected in on the salon screen, which
  // is also the order they'll be performed in for the visit.
  const services: Service[] = serviceIds
    .map((id) => salon?.services.find((x) => x.id === id))
    .filter((x): x is Service => Boolean(x));
  const firstService = services[0];
  const totalPrice = services.reduce((sum, x) => sum + x.price, 0);
  const totalDuration = services.reduce((sum, x) => sum + x.duration, 0);
  // Client-side estimate only, for the review step — the server (create_customer_
  // booking_group) computes and saves the real per-service times on confirm.
  const estimatedSchedule = (startIso: string) => {
    let cursor = new Date(startIso);
    return services.map((svc) => {
      const start = new Date(cursor);
      cursor = new Date(cursor.getTime() + svc.duration * 60_000);
      return { service: svc, start, end: new Date(cursor) };
    });
  };
  const loadSlots = async () => {
    if (!salon || !firstService) return;
    setSlotLoading(true);
    setError("");
    setTime("");
    try {
      setSlots(await fetchAvailability(salon.id, firstService.id, date));
    } catch (e) {
      setSlots([]);
      setError(bookingErrorMessage(e));
    } finally {
      setSlotLoading(false);
    }
  };
  const next = async () => {
    if (step === 2) {
      setStep(3);
      await loadSlots();
    } else if (step < 4) setStep(step + 1);
  };
  const confirm = async () => {
    if (!session) {
      Alert.alert(
        "Sign in required",
        "Please sign in from Profile before confirming this booking.",
      );
      return;
    }
    if (!salon || services.length === 0 || !time) return;
    setBusy(true);
    setError("");
    try {
      const result = await createBookingGroup({ serviceIds, startTime: time });
      router.replace({
        pathname: "/booking-confirmation",
        params: {
          salon: salon.name,
          items: JSON.stringify(result.items),
          total: String(result.total),
        },
      });
    } catch (e) {
      setError(bookingErrorMessage(e));
      setTime("");
      setStep(3);
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  if ((error && !salon) || !salon || services.length === 0)
    return (
      <Screen>
        <Text style={s.title}>
          {error || "This salon or service is unavailable."}
        </Text>
        <Pressable onPress={() => router.back()} style={s.primary}>
          <Text style={s.primaryText}>Go back</Text>
        </Pressable>
      </Screen>
    );
  return (
    <Screen>
      <View style={s.nav}>
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={4}
          style={s.backButton}
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
        >
          <Text style={s.back}>�</Text>
        </Pressable>
        <Text style={s.navTitle}>Book appointment</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.steps}>
        {[1, 2, 3, 4].map((x) => (
          <View key={x} style={[s.dot, x <= step && s.dotActive]}>
            <Text style={[s.dotText, x <= step && s.dotTextActive]}>{x}</Text>
          </View>
        ))}
      </View>
      <Text style={s.kicker}>STEP {step} OF 4</Text>
      {step === 1 && (
        <>
          <Text style={s.title}>Selected services</Text>
          <View style={{ gap: spacing.sm }}>
            {services.map((svc) => (
              <View style={s.card} key={svc.id}>
                <Text style={s.service}>{svc.name}</Text>
                <View style={s.line}>
                  <Text style={s.muted}>{svc.duration} minutes</Text>
                  <Text style={s.price}>PKR {svc.price.toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.money}>
            <Text style={s.salon}>Total</Text>
            <Text style={s.price}>
              {totalDuration} min · PKR {totalPrice.toLocaleString()}
            </Text>
          </View>
          <Text style={s.note}>
            No barber selection is required. Your salon will handle the
            appointment.
          </Text>
        </>
      )}
      {step === 2 && (
        <>
          <Text style={s.title}>Choose a date</Text>
          <View style={s.grid}>
            {dates.map((x) => (
              <Choice
                key={x.value}
                label={x.label}
                selected={date === x.value}
                onPress={() => setDate(x.value)}
              />
            ))}
          </View>
        </>
      )}
      {step === 3 && (
        <>
          <Text style={s.title}>Choose an available slot</Text>
          <Text style={s.subtitle}>{date}</Text>
          {slotLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : error ? (
            <>
              <Text style={s.note}>{error}</Text>
              <Pressable onPress={loadSlots}>
                <Text style={s.price}>Try again</Text>
              </Pressable>
            </>
          ) : slots.length ? (
            <View style={s.grid}>
              {slots.map((x) => (
                <Choice
                  key={x.startTime}
                  label={x.startTime}
                  selected={time === x.startTime}
                  onPress={() => setTime(x.startTime)}
                />
              ))}
            </View>
          ) : (
            <Text style={s.note}>
              No slots are available. The salon may be closed on this date.
            </Text>
          )}
        </>
      )}
      {step === 4 && (
        <>
          <Text style={s.title}>Booking summary</Text>
          <Text style={s.salon}>{salon.name}</Text>
          <Text style={s.rowText}>
            {date} · starting {time}
          </Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {estimatedSchedule(time).map(({ service: svc, start, end }) => (
              <View style={s.card} key={svc.id}>
                <Text style={s.service}>{svc.name}</Text>
                <Text style={s.muted}>
                  {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {" – "}
                  {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} (est.)
                </Text>
                <View style={s.line}>
                  <Text style={s.muted}>{svc.duration} minutes</Text>
                  <Text style={s.price}>PKR {svc.price.toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.money}>
            <Text style={s.salon}>Total</Text>
            <Text style={s.price}>PKR {totalPrice.toLocaleString()}</Text>
          </View>
          <Text style={s.note}>
            Estimated times shown above — final times are calculated and saved by
            the salon backend when you confirm. This is pay-at-salon; no payment is
            collected now.
          </Text>
        </>
      )}
      <Pressable
        disabled={busy || slotLoading || (step === 3 && !time)}
        onPress={step === 4 ? confirm : next}
        style={[
          s.primary,
          (busy || slotLoading || (step === 3 && !time)) && s.disabled,
        ]}
      >
        <Text style={s.primaryText}>
          {busy ? "Confirming�" : step === 4 ? "Confirm booking" : "Continue"}
        </Text>
      </Pressable>
    </Screen>
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
function Money({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.money}>
      <Text style={s.muted}>{label}</Text>
      <Text style={s.price}>PKR {value.toLocaleString()}</Text>
    </View>
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
  navTitle: { fontWeight: "700", fontSize: 16, color: colors.text },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary },
  dotText: { color: colors.muted, fontWeight: "700" },
  dotTextActive: { color: colors.onPrimary },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  subtitle: { color: colors.muted, marginTop: -12, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  salon: { color: colors.text, fontSize: 17, fontWeight: "800" },
  service: { color: colors.muted, marginTop: 5 },
  rowText: { color: colors.text, marginTop: spacing.md },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  muted: { color: colors.muted },
  price: { color: colors.text, fontWeight: "800" },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
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
  section: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  payments: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  money: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  primary: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.4 },
});
