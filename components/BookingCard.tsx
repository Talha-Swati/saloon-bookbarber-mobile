import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/constants/theme";
import { Booking } from "@/types";

// Three visual states rather than two. "Missed" and "Cancelled" both file under the
// cancelled tab but are not the same event, and a live appointment that has already been
// checked in reads very differently from one that is merely confirmed — so the card
// shows the real status word and tints it by grouping.
const toneFor = (booking: Booking) =>
  booking.status === "upcoming" ? s.toneLive : booking.status === "completed" ? s.toneDone : s.toneClosed;

export function BookingCard({ booking }: { booking: Booking }) {
  const live = booking.status === "upcoming";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      <View style={s.row}>
        <Text style={s.salon}>{booking.salonName}</Text>
        <Text style={[s.status, toneFor(booking)]}>{booking.statusLabel.toUpperCase()}</Text>
      </View>
      <Text style={s.muted}>{booking.serviceName}</Text>
      <Text style={s.when}>
        📅 {booking.date} · {booking.time}
      </Text>
      {/* Only shown once a barber is actually assigned. An unassigned upcoming booking
          says so instead of leaving a blank where a name should be — the salon has not
          allocated anyone yet, and pretending otherwise would be worse than silence. */}
      {live &&
        (booking.professionalName ? (
          <Text style={s.barber}>✂️ with {booking.professionalName}</Text>
        ) : (
          <Text style={s.barberPending}>✂️ Barber being assigned by the salon</Text>
        ))}
      <View style={s.row}>
        <Text style={s.price}>PKR {booking.price.toLocaleString()}</Text>
        <Text style={s.button}>{live ? "Manage" : "View details"}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  salon: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  status: { fontSize: 10, fontWeight: "800", padding: 5, borderRadius: radius.pill, overflow: "hidden" },
  toneLive: { color: colors.deepGreen, backgroundColor: colors.primarySoft },
  toneDone: { color: colors.secondaryText, backgroundColor: colors.neutralSoft },
  toneClosed: { color: colors.danger, backgroundColor: colors.dangerSoft },
  muted: { color: colors.secondaryText, marginTop: 5 },
  when: { color: colors.text, marginTop: spacing.md, fontSize: 13 },
  barber: { color: colors.text, marginTop: 6, fontSize: 13, fontWeight: "600" },
  barberPending: { color: colors.muted, marginTop: 6, fontSize: 13 },
  price: { color: colors.text, fontWeight: "800" },
  button: { color: colors.deepGreen, fontWeight: "800" },
});
