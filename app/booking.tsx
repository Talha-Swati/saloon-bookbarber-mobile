import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import {
  AppBar,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Icon,
  Notice,
  Skeleton,
  StepProgress,
  enterUp,
  haptics,
} from "@/components/ui";
import { colors, motion, radius, spacing, type } from "@/constants/theme";
import { AvailabilitySlot, Salon, Service } from "@/types";
import {
  bookingErrorMessage,
  createBookingGroup,
  fetchAvailability,
  fetchSalon,
} from "@/services/salonService";
import { DummyPaymentError, PAYMENT_TEST_MODE, runDummyEasypaisaPayment } from "@/services/dummyPayment";
import { useAuth } from "@/providers/AuthProvider";
import { formatClockTime, formatDuration, formatPkr } from "@/utils/format";
import { BOOKING_WINDOW_DAYS, bookingDateLabel, bookingWindowDates } from "@/utils/bookingWindow";

/**
 * Three steps, not five.
 *
 * What went, and why:
 *
 *   - "Selected services" was step 1. It listed back the services the customer had
 *     chosen on the previous screen, seconds earlier, behind a Continue button — a whole
 *     screen asking them to confirm something they had just done. It is now a summary
 *     strip at the top of step 1, where it is visible for the whole flow instead of
 *     being shown once and then hidden.
 *   - "Choose a date" and "choose a slot" were two steps. They are one decision: nobody
 *     picks a day without caring what times are free on it, and splitting them meant
 *     discovering a day was fully booked only after committing to it — then a tap back,
 *     a tap on the next day, and a tap forward. Dates and times now sit on one screen,
 *     and changing the date reloads the times underneath it.
 *
 * Each screen removed from a checkout is measurable: this is the difference between a
 * booking that takes five taps and one that takes eleven.
 */
const STEPS = ["Pick a time", "Confirm", "Pay"] as const;
const TIME_STEP = 1;
const REVIEW_STEP = 2;
const PAYMENT_STEP = 3;

export default function BookingFlow() {
  const p = useLocalSearchParams<{ salonId: string; serviceIds: string }>();
  const { session: activeSession, role } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [step, setStep] = useState<number>(TIME_STEP);
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
  const [slotError, setSlotError] = useState("");

  // Payment step state. Nothing here is persisted or transmitted — see
  // services/dummyPayment.ts.
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [payError, setPayError] = useState("");

  const serviceIds = useMemo(() => (p.serviceIds ?? "").split(",").filter(Boolean), [p.serviceIds]);

  useEffect(() => {
    if (!p.salonId) return;
    fetchSalon(p.salonId)
      .then(setSalon)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [p.salonId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > TIME_STEP) {
        setStep((value) => value - 1);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [step]);

  // Order reflects the order services were selected in on the salon screen, which
  // is also the order they'll be performed in for the visit.
  const services: Service[] = useMemo(
    () =>
      serviceIds
        .map((id) => salon?.services.find((service) => service.id === id))
        .filter((service): service is Service => Boolean(service)),
    [salon, serviceIds],
  );
  const firstService = services[0];
  const totalPrice = services.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = services.reduce((sum, service) => sum + service.duration, 0);

  // Client-side estimate only, for the review step — the server (create_customer_
  // booking_group) computes and saves the real per-service times on confirm.
  const estimatedSchedule = (startIso: string) => {
    let cursor = new Date(startIso);
    return services.map((service) => {
      const start = new Date(cursor);
      cursor = new Date(cursor.getTime() + service.duration * 60_000);
      return { service, start, end: new Date(cursor) };
    });
  };

  const loadSlots = useCallback(async () => {
    if (!salon || !firstService) return;
    setSlotLoading(true);
    setSlotError("");
    setTime("");
    try {
      setSlots(await fetchAvailability(salon.id, firstService.id, date));
    } catch (e) {
      setSlots([]);
      setSlotError(bookingErrorMessage(e));
    } finally {
      setSlotLoading(false);
    }
  }, [date, firstService, salon]);

  // Times load for whatever date is selected, including the one the screen opens on.
  // Under the old two-step flow this ran once, on the transition between the date screen
  // and the slot screen; here the date is a filter over the times below it, so the times
  // follow the date.
  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

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
      setStep(REVIEW_STEP);
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
      haptics.error();
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
      haptics.error();
      setError(
        `${bookingErrorMessage(e)}${
          PAYMENT_TEST_MODE ? " No money was taken — this is a test-mode payment." : ""
        }`,
      );
      setPin("");
      setStep(TIME_STEP);
      await loadSlots();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppBar title="Book appointment" />
        <View style={s.loading}>
          <Skeleton height={6} />
          <Skeleton height={72} style={{ borderRadius: radius.md }} />
          <Skeleton height={62} style={{ borderRadius: radius.md }} />
          <Skeleton height={140} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  if ((error && !salon) || !salon || services.length === 0) {
    return (
      <Screen>
        <AppBar title="Book appointment" />
        <EmptyState
          actionLabel="Go back"
          body={error || "This salon or service is no longer available."}
          onAction={() => router.back()}
          title="Cannot book this visit"
          tone="error"
        />
      </Screen>
    );
  }

  const canContinue =
    step === TIME_STEP ? Boolean(time) && !slotLoading : step === REVIEW_STEP ? Boolean(session) : true;

  const primary =
    step === TIME_STEP
      ? { label: "Review booking", onPress: () => setStep(REVIEW_STEP) }
      : step === REVIEW_STEP
        ? session
          ? { label: "Continue to payment", onPress: () => setStep(PAYMENT_STEP) }
          : { label: "Sign in to continue", onPress: () => router.push("/auth/sign-in") }
        : { label: `Pay ${formatPkr(totalPrice)}`, onPress: payAndConfirm };

  return (
    <Screen
      footer={
        <>
          <Button
            disabled={step === REVIEW_STEP && !session ? false : !canContinue}
            label={primary.label}
            loading={busy}
            onPress={primary.onPress}
          />
          {step === PAYMENT_STEP && busy ? (
            <Text style={s.processing}>Authorising with Easypaisa…</Text>
          ) : null}
        </>
      }
    >
      <AppBar
        onBack={() => (step > TIME_STEP ? setStep(step - 1) : router.back())}
        title="Book appointment"
      />

      <StepProgress label={STEPS[step - 1]} step={step} total={STEPS.length} />

      {/*
        The basket, visible on every step rather than being a step of its own. This is
        what someone glances at to check they are booking the right thing, and glancing
        should not cost two taps back and two forward.
      */}
      <Card style={s.basket} tone="raised">
        <View style={s.basketTop}>
          <Text numberOfLines={1} style={s.basketSalon}>
            {salon.name}
          </Text>
          <Text style={s.basketTotal}>{formatPkr(totalPrice)}</Text>
        </View>
        <Text numberOfLines={2} style={s.basketServices}>
          {services.map((service) => service.name).join(" · ")}
        </Text>
        <Text style={s.basketMeta}>
          {services.length} service{services.length === 1 ? "" : "s"} ·{" "}
          {formatDuration(totalDuration)}
        </Text>
      </Card>

      {error ? <View style={s.notice}><Notice body={error} title="Booking not completed" tone="danger" /></View> : null}

      {step === TIME_STEP ? (
        <Animated.View entering={FadeIn.duration(motion.fast)}>
          <Text style={s.heading}>When would you like to come in?</Text>
          <Text style={s.sub}>You can book up to {BOOKING_WINDOW_DAYS} days ahead.</Text>

          <View style={s.dates}>
            {/*
              Two lines per chip: the weekday a person thinks in ("Thu"), and the date
              they check against a calendar ("25 Sep"). The shared booking-window helper
              returns one combined string because the web app renders it in a dropdown;
              splitting it here is presentation, and leaves that mirrored rule untouched.
            */}
            {dates.map((day, index) => {
              const [year, month, dayNumber] = day.value.split("-").map(Number);
              const asDate = new Date(year, month - 1, dayNumber);
              return (
                <Chip
                  key={day.value}
                  label={
                    index === 0
                      ? "Today"
                      : index === 1
                        ? "Tomorrow"
                        : asDate.toLocaleDateString(undefined, { weekday: "short" })
                  }
                  onPress={() => setDate(day.value)}
                  selected={date === day.value}
                  sublabel={asDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                />
              );
            })}
          </View>

          <Text style={s.heading}>Available times</Text>
          <Text style={s.sub}>{bookingDateLabel(date)}</Text>

          {slotLoading ? (
            <View style={s.slotSkeleton}>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton height={44} key={i} style={{ borderRadius: radius.pill }} width={96} />
              ))}
            </View>
          ) : slotError ? (
            <EmptyState
              actionLabel="Try again"
              body={slotError}
              onAction={loadSlots}
              title="Times did not load"
              tone="error"
            />
          ) : slots.length ? (
            <View style={s.slots}>
              {slots.map((slot) => (
                <Chip
                  key={slot.startTime}
                  label={formatClockTime(slot.startTime)}
                  onPress={() => setTime(slot.startTime)}
                  selected={time === slot.startTime}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              body="The salon is closed or fully booked on this day. Try another date above."
              icon="clock"
              title="No times on this day"
            />
          )}
        </Animated.View>
      ) : null}

      {step === REVIEW_STEP ? (
        <Animated.View entering={FadeIn.duration(motion.fast)}>
          <Text style={s.heading}>Check the details</Text>

          <Card style={s.when} tone="raised">
            <Icon color={colors.deepGreen} name="calendar" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={s.whenTitle}>
                {bookingDateLabel(date)}, {formatClockTime(time)}
              </Text>
              <Text style={s.whenMeta}>
                Finishes about {formatClockTime(
                  new Date(new Date(time).getTime() + totalDuration * 60_000).toISOString(),
                )}
              </Text>
            </View>
          </Card>

          <Text style={s.listHeading}>Your visit, in order</Text>
          {estimatedSchedule(time).map(({ service, start, end }, index) => (
            <Animated.View entering={enterUp(index)} key={service.id}>
              <Card style={s.line}>
                <View style={s.stepDot}>
                  <Text style={s.stepDotText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.lineName}>{service.name}</Text>
                  <Text style={s.lineMeta}>
                    {formatClockTime(start.toISOString())} – {formatClockTime(end.toISOString())} ·{" "}
                    {formatDuration(service.duration)}
                  </Text>
                </View>
                <Text style={s.linePrice}>{formatPkr(service.price)}</Text>
              </Card>
            </Animated.View>
          ))}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatPkr(totalPrice)}</Text>
          </View>

          <Text style={s.note}>
            Times are an estimate. The salon assigns a free barber automatically and saves
            the exact times when your payment clears.
          </Text>

          {!session ? (
            <View style={s.notice}>
              <Notice
                body="A booking has to belong to an account so you can see it, change it and cancel it."
                title="Sign in to confirm this booking"
                tone="info"
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {step === PAYMENT_STEP ? (
        <Animated.View entering={FadeIn.duration(motion.fast)}>
          {/* Impossible to miss, and above the amount. A payment screen that looks
              real and takes nothing must say so before anything else. */}
          {PAYMENT_TEST_MODE ? (
            <View style={s.notice}>
              <Notice
                body="Easypaisa is not connected yet. Nothing is charged, no money moves and no wallet is contacted. Any 5-digit PIN works."
                title="Test mode — no real payment"
                tone="warning"
              />
            </View>
          ) : null}

          <View style={s.amountCard}>
            <Text style={s.amountLabel}>AMOUNT DUE</Text>
            <Text style={s.amountValue}>{formatPkr(totalPrice)}</Text>
            <Text style={s.amountMeta}>
              {services.length} service{services.length === 1 ? "" : "s"} at {salon.name}
            </Text>
          </View>

          <Text style={s.listHeading}>Pay with</Text>
          <Card selected style={s.method}>
            <View style={s.methodMark}>
              <Text style={s.methodMarkText}>ep</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.methodName}>Easypaisa</Text>
              <Text style={s.lineMeta}>Mobile account</Text>
            </View>
            <Icon color={colors.deepGreen} name="checkCircle" size={22} />
          </Card>

          <View style={s.form}>
            <Field
              autoComplete="tel"
              error={payError && /mobile/i.test(payError) ? payError : undefined}
              icon="phone"
              keyboardType="phone-pad"
              label="Easypaisa mobile number"
              maxLength={15}
              onChangeText={(value) => {
                setMobile(value);
                if (payError) setPayError("");
              }}
              placeholder="0300 1234567"
              value={mobile}
            />
            <Field
              error={payError && !/mobile/i.test(payError) ? payError : undefined}
              hint="Five digits."
              icon="lock"
              keyboardType="number-pad"
              label="Easypaisa PIN"
              maxLength={5}
              onChangeText={(value) => {
                setPin(value.replace(/\D/g, ""));
                if (payError) setPayError("");
              }}
              password
              placeholder="•••••"
              value={pin}
            />
          </View>

          <Text style={s.note}>
            Your slot is confirmed the moment payment clears. If someone takes the same
            slot first you will be asked to pick another time, and nothing is charged.
          </Text>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md, marginTop: spacing.md },
  basket: { gap: 5, marginBottom: spacing.lg },
  basketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  basketSalon: { ...type.cardTitle, color: colors.text, flex: 1 },
  basketTotal: { ...type.cardTitle, color: colors.deepGreen },
  basketServices: { ...type.caption, color: colors.secondaryText },
  basketMeta: { ...type.label, fontWeight: "400", color: colors.muted },
  notice: { marginBottom: spacing.lg },
  heading: { ...type.section, color: colors.text, marginTop: spacing.md },
  sub: { ...type.caption, color: colors.muted, marginTop: 4, marginBottom: spacing.md },
  dates: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slotSkeleton: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  when: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  whenTitle: { ...type.cardTitle, color: colors.text },
  whenMeta: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: 3 },
  listHeading: { ...type.label, color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { ...type.label, fontSize: 11, color: colors.deepGreen },
  lineName: { ...type.bodyStrong, color: colors.text },
  lineMeta: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: 3 },
  linePrice: { ...type.bodyStrong, color: colors.text },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  totalLabel: { ...type.cardTitle, color: colors.text },
  totalValue: { ...type.title, fontSize: 22, lineHeight: 28, color: colors.text },
  note: { ...type.label, fontWeight: "400", color: colors.muted, lineHeight: 18, marginTop: spacing.sm },
  amountCard: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.lg },
  amountLabel: { ...type.eyebrow, color: colors.deepGreen },
  amountValue: { fontSize: 34, lineHeight: 42, fontWeight: "800", color: colors.text, marginVertical: 4 },
  amountMeta: { ...type.caption, color: colors.secondaryText },
  method: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  methodMark: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: "#0F7A3D",
    alignItems: "center",
    justifyContent: "center",
  },
  methodMarkText: { color: "#FFFFFF", fontWeight: "800", fontSize: 18 },
  methodName: { ...type.bodyStrong, color: colors.text },
  form: { marginTop: spacing.lg },
  processing: { ...type.label, fontWeight: "400", color: colors.muted, textAlign: "center", marginTop: spacing.sm },
});
