import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { formatRating } from '@/utils/format';
import { Salon } from '@/types';

// Three fields this card used to render came from columns `salons` does not have, so
// they were undefined on every request and the fallback beside each one is what actually
// shipped: `salon.distanceKm` printed " . 0 km" under every salon, `salon.featured` could
// never be true so the FEATURED badge was dead markup, and `salon.accent` was always the
// same hardcoded green - which belongs in the theme, not on a database row. Rating is now
// formatted rather than interpolated raw; see utils/format.ts.
export function SalonCard({ salon }: { salon: Salon }) {
  const rating = formatRating(salon.rating);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/salon/[id]', params: { id: salon.id } })}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.88 }]}
    >
      <View style={s.image}>
        <Text style={s.mono}>{salon.name[0]}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.name}>{salon.name}</Text>
        <Text style={s.meta}>
          {[salon.area, salon.city].filter(Boolean).join(', ')}
        </Text>
        <View style={s.row}>
          {rating ? (
            <Text style={s.rating}>
              ★ {rating} <Text style={s.meta}>({salon.reviews})</Text>
            </Text>
          ) : (
            <Text style={s.meta}>No reviews yet</Text>
          )}
          <Text style={s.price}>from PKR {salon.startingPrice.toLocaleString()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow,
  },
  image: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.deepGreen,
  },
  mono: { color: colors.onDark, fontSize: 44, fontWeight: '800' },
  body: { padding: spacing.md },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.secondaryText, fontSize: 13, marginTop: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  rating: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  price: { color: colors.deepGreen, fontSize: 13, fontWeight: '700' },
});
