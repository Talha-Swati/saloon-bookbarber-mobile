import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Card, Icon } from "@/components/ui";
import { formatPkr, formatRating } from "@/utils/format";
import { Salon } from "@/types";

// Three fields this card used to render came from columns `salons` does not have, so
// they were undefined on every request and the fallback beside each one is what actually
// shipped: `salon.distanceKm` printed " . 0 km" under every salon, `salon.featured` could
// never be true so the FEATURED badge was dead markup, and `salon.accent` was always the
// same hardcoded green - which belongs in the theme, not on a database row. Rating is now
// formatted rather than interpolated raw; see utils/format.ts.
//
// The layout is a row, not a banner. `salons` carries no photograph, so the 108px banner
// this replaces was a block of flat green with one letter in it — a hundred wasted pixels
// per salon that pushed the third result off the screen. A monogram tile says the same
// thing in a quarter of the space, and a discovery list is judged on how many real
// choices it puts in front of someone at once.
export function SalonCard({ salon }: { salon: Salon }) {
  const rating = formatRating(salon.rating);
  const place = [salon.area, salon.city].filter(Boolean).join(", ");

  return (
    <Card
      accessibilityLabel={`${salon.name}, ${place || "location unavailable"}`}
      onPress={() => router.push({ pathname: "/salon/[id]", params: { id: salon.id } })}
      style={s.card}
      tone="raised"
    >
      <View style={s.row}>
        <View style={s.monogram}>
          <Text style={s.initial}>{salon.name[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View style={s.body}>
          <Text numberOfLines={1} style={s.name}>
            {salon.name}
          </Text>
          {place ? (
            <View style={s.metaRow}>
              <Icon color={colors.muted} name="location" size={13} />
              <Text numberOfLines={1} style={s.meta}>
                {place}
              </Text>
            </View>
          ) : null}
          <View style={s.metaRow}>
            {rating ? (
              <>
                <Icon color="#E0A612" name="star" size={13} />
                <Text style={s.rating}>{rating}</Text>
                <Text style={s.meta}>({salon.reviews})</Text>
              </>
            ) : (
              // Not "★ 0.0". A salon nobody has reviewed is new, not bad, and the two
              // must never render the same way.
              <Text style={s.new}>New on BookBarber</Text>
            )}
            <Text style={s.dot}>·</Text>
            <Text style={s.meta}>
              {salon.services.length} service{salon.services.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
        <View style={s.trailing}>
          <Text style={s.fromLabel}>from</Text>
          <Text style={s.price}>{formatPkr(salon.startingPrice)}</Text>
          <Icon color={colors.muted} name="forward" size={16} />
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  monogram: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.deepGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.onDark, fontSize: 24, fontWeight: "800" },
  body: { flex: 1, gap: 4 },
  name: { ...type.cardTitle, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { ...type.label, fontWeight: "400", color: colors.muted, flexShrink: 1 },
  rating: { ...type.label, color: colors.text },
  new: { ...type.label, fontWeight: "700", color: colors.deepGreen },
  dot: { color: colors.border },
  trailing: { alignItems: "flex-end", gap: 2 },
  fromLabel: { ...type.label, fontSize: 10, fontWeight: "400", color: colors.muted },
  price: { ...type.label, fontSize: 13, color: colors.deepGreen },
});
