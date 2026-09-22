import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import {
  AppBar,
  Button,
  Card,
  EmptyState,
  Icon,
  Notice,
  PressableScale,
  Skeleton,
  SuccessMark,
  enterUp,
  haptics,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { fetchBooking } from "@/services/salonService";
import { reviewErrorMessage, submitReview } from "@/services/reviewService";
import { formatDateLabel } from "@/utils/format";
import type { Booking } from "@/types";

const MAX = 240;

/** What each rating means, so a person is not left guessing whether 3 is good. */
const MEANING = ["", "Poor", "Not great", "Fine", "Good", "Excellent"];

function Star({ index, rating, onPress }: { index: number; rating: number; onPress: () => void }) {
  const on = index <= rating;
  /**
   * Every filled star swells; the empty ones sit back at their normal size.
   *
   * Derived from `rating` rather than fired imperatively on the tap, which matters for
   * more than tidiness: tapping 2 after 4 has to shrink stars 3 and 4 back down, and an
   * animation that only runs on the star you touched cannot do that. Spring the whole row
   * off one value and lowering a rating animates as naturally as raising it.
   */
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(on ? 1.12 : 1, { damping: 10, mass: 0.5 }) }],
  }));
  return (
    <PressableScale
      accessibilityLabel={`${index} star${index === 1 ? "" : "s"}`}
      accessibilityState={{ selected: on }}
      haptic={false}
      hitSlop={6}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      scaleTo={0.88}
    >
      <Animated.View style={style}>
        <Icon color={on ? "#E0A612" : colors.border} name="star" size={38} />
      </Animated.View>
    </PressableScale>
  );
}

export default function Review() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    setLoadError("");
    fetchBooking(bookingId)
      .then(setBooking)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const submit = async () => {
    if (!bookingId || !rating || !comment.trim()) return;
    setBusy(true);
    setSubmitError("");
    try {
      await submitReview({ bookingId, rating, comment: comment.trim() });
      setSent(true);
    } catch (error) {
      haptics.error();
      setSubmitError(reviewErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppBar title="Review" />
        <View style={s.loading}>
          <Skeleton height={26} width="65%" />
          <Skeleton height={72} style={{ borderRadius: radius.md }} />
          <Skeleton height={120} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  if (loadError || !booking || booking.status !== "completed") {
    return (
      <Screen>
        <AppBar title="Review" />
        <EmptyState
          actionLabel="Back to my bookings"
          body={loadError || "A visit can be reviewed once the salon has marked it complete."}
          onAction={() => router.replace("/(tabs)/bookings")}
          title="Nothing to review yet"
          tone="error"
        />
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen>
        <View style={s.done}>
          <SuccessMark />
          <Animated.Text entering={enterUp(1)} style={s.doneTitle}>
            Thanks for the review
          </Animated.Text>
          <Animated.Text entering={enterUp(2)} style={s.doneBody}>
            It is now on {booking.salonName}, and it helps the next customer choose.
          </Animated.Text>
          <Button
            label="Back to my bookings"
            onPress={() => router.replace("/(tabs)/bookings")}
            style={s.doneAction}
          />
        </View>
      </Screen>
    );
  }

  const ready = rating > 0 && comment.trim().length > 0;

  return (
    <Screen
      footer={
        <Button
          disabled={!ready}
          label="Post review"
          loading={busy}
          onPress={submit}
        />
      }
    >
      <AppBar title="Review" />

      <Animated.View entering={enterUp()}>
        <Text style={s.title}>How was your visit?</Text>
      </Animated.View>

      <Animated.View entering={enterUp(1)}>
        <Card style={s.booking}>
          <Text style={s.salon}>{booking.salonName}</Text>
          <Text style={s.meta}>
            {booking.serviceName} · {formatDateLabel(booking.startTime)}
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={enterUp(2)}>
        <Text style={s.label}>Your rating</Text>
        <View style={s.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Star index={value} key={value} onPress={() => setRating(value)} rating={rating} />
          ))}
        </View>
        {/* Reserved whether or not a rating is set, so the comment box does not jump
            down the screen the moment a star is tapped. */}
        <Text style={s.meaning}>{rating ? MEANING[rating] : " "}</Text>
      </Animated.View>

      <Animated.View entering={enterUp(3)}>
        <Text style={s.label}>What happened</Text>
        <TextInput
          accessibilityLabel="Your review"
          maxLength={MAX}
          multiline
          onChangeText={setComment}
          placeholder="Was the barber on time? Did you get what you asked for?"
          placeholderTextColor={colors.muted}
          style={s.input}
          value={comment}
        />
        <Text style={s.count}>
          {comment.length}/{MAX}
        </Text>
      </Animated.View>

      {submitError ? (
        <View style={s.notice}>
          <Notice body={submitError} title="Review not posted" tone="danger" />
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md, marginTop: spacing.md },
  title: { ...type.display, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg },
  booking: { gap: 4 },
  salon: { ...type.cardTitle, color: colors.text },
  meta: { ...type.caption, color: colors.muted },
  label: { ...type.label, color: colors.secondaryText, marginTop: spacing.lg, marginBottom: spacing.sm },
  stars: { flexDirection: "row", gap: spacing.sm },
  meaning: { ...type.caption, fontWeight: "700", color: colors.deepGreen, marginTop: spacing.sm, minHeight: 20 },
  input: {
    minHeight: 130,
    textAlignVertical: "top",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...type.body,
    color: colors.text,
  },
  count: { ...type.label, fontSize: 11, fontWeight: "400", color: colors.muted, textAlign: "right", marginTop: 5 },
  notice: { marginTop: spacing.md },
  done: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  doneTitle: { ...type.display, color: colors.text, marginTop: spacing.md, textAlign: "center" },
  doneBody: {
    ...type.body,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  doneAction: { alignSelf: "stretch", marginTop: spacing.xl },
});
