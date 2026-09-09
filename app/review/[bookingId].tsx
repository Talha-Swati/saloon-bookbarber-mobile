import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { fetchBooking } from "@/services/salonService";
import { reviewErrorMessage, submitReview } from "@/services/reviewService";
import type { Booking } from "@/types";

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
      setSubmitError(reviewErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (loadError || !booking || booking.status !== "completed") {
    return (
      <Screen>
        <Pressable accessibilityLabel="Go back" hitSlop={4} style={s.backButton} onPress={() => router.back()}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <View style={s.center}>
          <Text style={s.title}>Review unavailable</Text>
          <Text style={s.muted}>
            {loadError || "Reviews can only be submitted for completed bookings."}
          </Text>
        </View>
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen>
        <View style={s.center}>
          <View style={s.check}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={s.title}>Thanks for your review</Text>
          <Text style={s.muted}>Your feedback helps customers choose with confidence.</Text>
          <Pressable onPress={() => router.replace("/(tabs)/bookings")} style={s.primary}>
            <Text style={s.primaryText}>Back to My Bookings</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable accessibilityLabel="Go back" hitSlop={4} style={s.backButton} onPress={() => router.back()}>
        <Text style={s.back}>‹</Text>
      </Pressable>
      <Text style={s.kicker}>SHARE YOUR EXPERIENCE</Text>
      <Text style={s.title}>How was your visit?</Text>
      <View style={s.card}>
        <Text style={s.salon}>{booking.salonName}</Text>
        <Text style={s.muted}>
          {booking.serviceName} · {booking.date}
        </Text>
      </View>
      <Text style={s.label}>Your rating</Text>
      <View style={s.stars}>
        {[1, 2, 3, 4, 5].map((x) => (
          <Pressable key={x} hitSlop={8} onPress={() => setRating(x)}>
            <Text style={[s.star, x <= rating && s.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.label}>Short comment</Text>
      <TextInput
        multiline
        maxLength={240}
        value={comment}
        onChangeText={setComment}
        placeholder="What did you like about your visit?"
        placeholderTextColor={colors.muted}
        style={s.input}
      />
      <Text style={s.count}>{comment.length}/240</Text>
      {submitError ? <Text style={s.error}>{submitError}</Text> : null}
      <Pressable
        disabled={!rating || !comment.trim() || busy}
        onPress={submit}
        style={[s.primary, (!rating || !comment.trim() || busy) && { opacity: 0.4 }]}
      >
        <Text style={s.primaryText}>{busy ? "Submitting…" : "Submit review"}</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  backButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  back: { fontSize: 36, color: colors.text, lineHeight: 40 },
  kicker: { color: colors.deepGreen, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: spacing.md },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: spacing.sm },
  muted: { color: colors.muted, textAlign: "center", lineHeight: 20, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  salon: { fontSize: 17, color: colors.text, fontWeight: "800" },
  label: { color: colors.text, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  stars: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  star: { fontSize: 38, color: colors.border },
  starOn: { color: colors.warning },
  input: {
    minHeight: 120,
    textAlignVertical: "top",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  count: { color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 5 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center" },
  primary: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  center: { alignItems: "center", justifyContent: "center", paddingTop: 100 },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 36, color: colors.deepGreen, fontWeight: "800" },
});
