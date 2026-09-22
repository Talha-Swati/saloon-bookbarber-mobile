import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Card, Icon, PillTone, StatusPill } from "@/components/ui";
import { formatDuration, formatPkr, relativeDayLabel } from "@/utils/format";
import { Booking } from "@/types";

/**
 * Four tones rather than three. "Missed" and "Cancelled" both file under the cancelled
 * tab but are not the same event, and "Awaiting payment" is a booking that needs
 * something FROM the customer — which is the one state that must not look like the
 * settled green of a confirmed appointment.
 */
const toneFor = (booking: Booking): PillTone => {
  if (booking.statusLabel === "Awaiting payment") return "pending";
  if (booking.status === "upcoming") return "live";
  if (booking.status === "completed") return "done";
  return "stopped";
};

type Props = {
  booking: Booking;
  /**
   * `hero` is the single next appointment on the home screen: bigger, tinted, and
   * leading with how soon it is. `row` is every other listing.
   */
  variant?: "row" | "hero";
};

export function BookingCard({ booking, variant = "row" }: Props) {
  const live = booking.status === "upcoming";
  const hero = variant === "hero";
  const when = relativeDayLabel(booking.startTime);

  return (
    <Card
      accessibilityLabel={`${booking.serviceName} at ${booking.salonName}, ${when} at ${booking.time}`}
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
      style={[s.card, hero && s.hero]}
      tone={hero ? "raised" : "flat"}
    >
      <View style={s.topRow}>
        {/*
          The soonest-first line, in the largest type on the card. A date on its own —
          "Sat, 26 Sep 2026" — makes a person work out for themselves whether that is
          tomorrow or next week, and this card exists to answer exactly that.
        */}
        <Text style={[s.when, hero && s.whenHero]}>
          {when} · {booking.time}
        </Text>
        <StatusPill label={booking.statusLabel} tone={toneFor(booking)} />
      </View>

      <Text numberOfLines={1} style={s.service}>
        {booking.serviceName}
      </Text>
      <View style={s.metaRow}>
        <Icon color={colors.muted} name="salons" size={13} />
        <Text numberOfLines={1} style={s.meta}>
          {booking.salonName}
        </Text>
        <Text style={s.dot}>·</Text>
        <Text style={s.meta}>{formatDuration(booking.duration)}</Text>
      </View>

      {/* Only once a barber is actually assigned. An unassigned upcoming booking says so
          instead of leaving a blank where a name should be — the salon has not allocated
          anyone yet, and pretending otherwise would be worse than silence. */}
      {live ? (
        <View style={s.metaRow}>
          <Icon color={booking.professionalName ? colors.deepGreen : colors.muted} name="scissors" size={13} />
          <Text style={[s.meta, booking.professionalName && s.barber]}>
            {booking.professionalName
              ? `with ${booking.professionalName}`
              : "Barber being assigned by the salon"}
          </Text>
        </View>
      ) : null}

      <View style={s.footer}>
        <Text style={s.price}>{formatPkr(booking.price)}</Text>
        <View style={s.cta}>
          <Text style={s.ctaText}>{live ? "Manage booking" : "View details"}</Text>
          <Icon color={colors.deepGreen} name="forward" size={14} />
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: 6 },
  hero: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  when: { ...type.cardTitle, color: colors.text, flexShrink: 1 },
  whenHero: { ...type.title, fontSize: 20, lineHeight: 26 },
  service: { ...type.body, color: colors.text, fontWeight: "600", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { ...type.label, fontWeight: "400", color: colors.secondaryText, flexShrink: 1 },
  barber: { color: colors.deepGreen, fontWeight: "700" },
  dot: { color: colors.border },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  price: { ...type.bodyStrong, color: colors.text },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  ctaText: { ...type.caption, fontWeight: "800", color: colors.deepGreen },
});
