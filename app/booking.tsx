import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { ActivityIndicator, Alert } from "react-native";
import { AvailabilitySlot, Salon } from "@/types";
import {
  bookingErrorMessage,
  createBooking,
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
  const p = useLocalSearchParams<{ salonId: string; serviceId: string }>();
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
  const service = salon?.services.find((x) => x.id === p.serviceId);
  const loadSlots = async () => {
    if (!salon || !service) return;
    setSlotLoading(true);
    setError("");
    setTime("");
    try {
      setSlots(await fetchAvailability(salon.id, service.id, date));
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
    if (!salon || !service || !time) return;
    setBusy(true);
    setError("");
    try {
      const result = await createBooking({
        salonId: salon.id,
        serviceId: service.id,
        bookingDate: date,
        startTime: time,
      });
      router.replace({
        pathname: "/booking-confirmation",
        params: {
          id: result.id,
          salon: result.salonName || salon.name,
          service: result.serviceName || service.name,
          date: result.bookingDate,
          time: result.startTime,
          total: String(result.total),
          deposit: String(result.deposit),
          remaining: String(result.remaining),
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
  if ((error && !salon) || !salon || !service)
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
          <Text style={s.back}>‹</Text>
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
          <Text style={s.title}>Selected service</Text>
          <Summary
            salon={salon.name}
            service={service.name}
            duration={service.duration}
            price={service.price}
          />
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
          <Summary
            salon={salon.name}
            service={service.name}
            duration={service.duration}
            price={service.price}
            date={date}
            time={time}
          />
          <Text style={s.note}>
            Final amounts are calculated and saved by the salon backend.
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
          {busy ? "Confirming…" : step === 4 ? "Confirm booking" : "Continue"}
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
function Summary({
  salon,
  service,
  duration,
  price,
  date,
  time,
}: {
  salon: string;
  service: string;
  duration: number;
  price: number;
  date?: string;
  time?: string;
}) {
  return (
    <View style={s.card}>
      <Text style={s.salon}>{salon}</Text>
      <Text style={s.service}>{service}</Text>
      {date && (
        <Text style={s.rowText}>
          {date} · {time}
        </Text>
      )}
      <View style={s.line}>
        <Text style={s.muted}>{duration} minutes</Text>
        <Text style={s.price}>PKR {price.toLocaleString()}</Text>
      </View>
    </View>
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
