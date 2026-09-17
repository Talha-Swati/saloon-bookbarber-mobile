import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
import {
  DummyPaymentError,
  PAYMENT_TEST_MODE,
  runDummyEasypaisaPayment,
} from "@/services/dummyPayment";
import { useAuth } from "@/providers/AuthProvider";
import { formatClockTime, formatPkr } from "@/utils/format";
import {
  BOOKING_WINDOW_DAYS,
  bookingDateLabel,
  bookingWindowDates,
} from "@/utils/bookingWindow";

// Services, date, slot, review, pay. Payment is the last step rather than an
// afterthought on the confirmation screen, because it is mandatory: the visit is not
// booked until it clears.
const TOTAL_STEPS = 5;
const PAYMENT_STEP = 5;

export default function BookingFlow() {
  const p = useLocalSearchParams<{ salonId: string; serviceIds: string }>();
  const { session: activeSession, role } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [step, setStep] = useState(1);
  // Phase 3C booking window: today + the next six calendar days, in the device's local
  // calendar. Computed per mount (not at module scope) so it cannot go stale.
  const dates = useMemo(() => bookingWindowDates(), []);
  const [date, setDate] = useState(dates[0].value);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotLoading, setSlotLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Payment step state. Nothing here is persisted or transmitted — see
  // services/dummyPayment.ts.
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [payError, setPayError] = useState("");

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
    } else if (step < TOTAL_STEPS) setStep(step + 1);
  };

  /**
   * Pay, then book — in that order, and only in that order.
   *
   * The booking is created AFTER payment clears rather than before, so an abandoned
   * checkout leaves nothing behind: no half-made appointment sitting in the salon's list
   * for a customer who walked away at the payment screen. The cost is that the slot is
   * not held during the (test-mode, ~2 second) payment, so somebody else can take it in
   * between. The server re-checks availability inside create_customer_booking and raises
   * SLOT_UNAVAILABLE, which is handled below by sending the customer back to pick
   * another time — with an explicit line about the money, because "your payment went
   * through but you have no booking" is the one thing a person must never be left
   * guessing about.
   */
  const payAndConfirm = async () => {
    if (!session) {
      Alert.alert(
        "Sign in required",
        "Please sign in from Profile before confirming this booking.",
      );
      return;
    }
    // Guards a double submit: the button is disabled while `busy` is true, but a fast
    // second tap can land before the re-render.
    if (busy || !salon || services.length === 0 || !time) return;
    setBusy(true);
    setPayError("");
    setError("");

    let payment;
    try {
      payment = await runDummyEasypaisaPayment({ mobile, pin, amount: totalPrice });
    } catch (e) {
      setBusy(false);
      setPayError(
        e instanceof DummyPaymentError
          ? e.message
          : "Payment could not be completed. Please try again.",
      );
      return;
    }

    try {
      const result = await createBookingGroup({ serviceIds, startTime: time });
      router.replace({
        pathname: "/booking-confirmation",
        params: {
          salon: salon.name,
          items: JSON.stringify(result.items),
          total: String(result.total),
          paymentReference: payment.reference,
          paymentAccount: payment.accountMasked,
        },
      });
    } catch (e) {
      setError(
        `${bookingErrorMessage(e)}${
          PAYMENT_TEST_MODE
            ? " No money was taken — this is a test-mode payment."
            : ""
        }`,
      );
      setPin("");
      setTime("");
      setStep(3);
      await loadSlots();
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

  const continueDisabled = busy || slotLoading || (step === 3 && !time);

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
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((x) => (
          <View key={x} style={[s.dot, x <= step && s.dotActive]}>
            <Text style={[s.dotText, x <= step && s.dotTextActive]}>{x}</Text>
          </View>
        ))}
      </View>
      <Text style={s.kicker}>
        STEP {step} OF {TOTAL_STEPS}
      </Text>
      {step === 1 && (
        <>
          <Text style={s.title}>Selected services</Text>
          <View style={{ gap: spacing.sm }}>
            {services.map((svc) => (
              <View style={s.card} key={svc.id}>
                <Text style={s.service}>{svc.name}</Text>
                <View style={s.line}>
                  <Text style={s.muted}>{svc.duration} minutes</Text>
                  <Text style={s.price}>{formatPkr(svc.price)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.money}>
            <Text style={s.salon}>Total</Text>
            <Text style={s.price}>
              {totalDuration} min · {formatPkr(totalPrice)}
            </Text>
          </View>
          <Text style={s.note}>
            No barber selection is required — the salon assigns a free barber to
            your visit automatically.
          </Text>
        </>
      )}
      {step === 2 && (
        <>
          <Text style={s.title}>Choose a date</Text>
          <Text style={s.subtitle}>
            Bookings open for the next {BOOKING_WINDOW_DAYS} days.
          </Text>
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
          <Text style={s.subtitle}>{bookingDateLabel(date)}</Text>
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
                  label={formatClockTime(x.startTime)}
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
            {bookingDateLabel(date)} · starting {formatClockTime(time)}
          </Text>
          <Text style={s.muted}>
            {services.length} service{services.length === 1 ? "" : "s"} ·{" "}
            {totalDuration} min
          </Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {estimatedSchedule(time).map(({ service: svc, start, end }) => (
              <View style={s.card} key={svc.id}>
                <Text style={s.service}>{svc.name}</Text>
                <Text style={s.muted}>
                  {formatClockTime(start.toISOString())} –{" "}
                  {formatClockTime(end.toISOString())} (est.)
                </Text>
                <View style={s.line}>
                  <Text style={s.muted}>{svc.duration} minutes</Text>
                  <Text style={s.price}>{formatPkr(svc.price)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.money}>
            <Text style={s.salon}>Total</Text>
            <Text style={s.price}>{formatPkr(totalPrice)}</Text>
          </View>
          <Text style={s.note}>
            Estimated times shown above — final times are calculated and saved by
            the salon backend once payment clears. Payment is required to confirm
            this booking.
          </Text>
        </>
      )}
      {step === PAYMENT_STEP && (
        <>
          <Text style={s.title}>Payment</Text>

          {/* Impossible to miss, and above the amount. A payment screen that looks
              real and takes nothing must say so before anything else. */}
          {PAYMENT_TEST_MODE && (
            <View style={s.testBanner}>
              <Text style={s.testBannerTitle}>TEST MODE — NO REAL PAYMENT</Text>
              <Text style={s.testBannerBody}>
                Easypaisa is not connected yet. Nothing is charged, no money moves
                and no card or wallet is contacted. Any 5-digit PIN works.
              </Text>
            </View>
          )}

          <View style={s.amountCard}>
            <Text style={s.amountLabel}>Amount due</Text>
            <Text style={s.amountValue}>{formatPkr(totalPrice)}</Text>
            <Text style={s.muted}>
              {services.length} service{services.length === 1 ? "" : "s"} at{" "}
              {salon.name}
            </Text>
          </View>

          <Text style={s.section}>Pay with</Text>
          <View style={s.methodCard}>
            <View style={s.methodMark}>
              <Text style={s.methodMarkText}>ep</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.methodName}>Easypaisa</Text>
              <Text style={s.muted}>Mobile account</Text>
            </View>
            <View style={s.radioOn}>
              <View style={s.radioDot} />
            </View>
          </View>

          <Text style={s.fieldLabel}>Easypaisa mobile number</Text>
          <TextInput
            autoComplete="tel"
            keyboardType="phone-pad"
            maxLength={15}
            onChangeText={(value) => {
              setMobile(value);
              if (payError) setPayError("");
            }}
            placeholder="03XX XXXXXXX"
            placeholderTextColor={colors.muted}
            style={s.input}
            value={mobile}
          />

          <Text style={s.fieldLabel}>Easypaisa PIN</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={(value) => {
              setPin(value.replace(/\D/g, ""));
              if (payError) setPayError("");
            }}
            placeholder="5-digit PIN"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={s.input}
            value={pin}
          />

          {payError ? <Text style={s.error}>{payError}</Text> : null}

          <Text style={s.note}>
            Your slot is confirmed the moment payment clears. If someone books the
            same slot first, you will be asked to pick another time and nothing is
            charged.
          </Text>
        </>
      )}
      <Pressable
        disabled={step === PAYMENT_STEP ? busy : continueDisabled}
        onPress={step === PAYMENT_STEP ? payAndConfirm : next}
        style={[
          s.primary,
          (step === PAYMENT_STEP ? busy : continueDisabled) && s.disabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={s.primaryText}>
            {step === PAYMENT_STEP
              ? `Pay ${formatPkr(totalPrice)}`
              : step === 4
                ? "Continue to payment"
                : "Continue"}
          </Text>
        )}
      </Pressable>
      {step === PAYMENT_STEP && busy && (
        <Text style={s.processing}>Authorising with Easypaisa…</Text>
      )}
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
}const s = StyleSheet.create({
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
  money: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  testBanner: {
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  amountCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  amountLabel: {
    color: colors.deepGreen,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  amountValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    marginVertical: 6,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  methodMark: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: "#0F7A3D",
    alignItems: "center",
    justifyContent: "center",
  },
  methodMarkText: { color: "#FFFFFF", fontWeight: "800", fontSize: 18 },
  methodName: { color: colors.text, fontWeight: "800", fontSize: 16 },
  radioOn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 19,
  },
  processing: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.sm,
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
