import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SalonCard } from "@/components/SalonCard";
import { Screen } from "@/components/Screen";
import {
  Chip,
  EmptyState,
  SearchBar,
  SkeletonList,
  enterUp,
  listTransition,
} from "@/components/ui";
import { colors, spacing, type } from "@/constants/theme";
import { fetchSalons, salonMatchesSearch } from "@/services/salonService";
import { Salon } from "@/types";

const ALL = "__all__";

/**
 * The full directory.
 *
 * Home and this screen used to be the same screen twice — identical search box over an
 * identical list — which left a person no reason to tap either tab. Home now leads with
 * what is personal (the next appointment) and shows four salons; this is the complete
 * list, and it filters by city, which is the question someone browsing actually has.
 */
export default function Salons() {
  const [items, setItems] = useState<Salon[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    return fetchSalons()
      .then(setItems)
      .catch(() => setError("We could not load salons. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const cities = useMemo(
    () => Array.from(new Set(items.map((salon) => salon.city).filter(Boolean))).sort(),
    [items],
  );

  const visible = useMemo(
    () =>
      items.filter(
        (salon) => salonMatchesSearch(salon, query) && (city === ALL || salon.city === city),
      ),
    [city, items, query],
  );

  const filtering = query.trim().length > 0 || city !== ALL;

  return (
    <Screen onRefresh={load}>
      <Animated.View entering={enterUp()}>
        <Text accessibilityRole="header" style={s.title}>
          Salons
        </Text>
        <Text style={s.sub}>Pick a salon, choose your services, then a time that is free.</Text>
      </Animated.View>

      <Animated.View entering={enterUp(1)} style={s.search}>
        <SearchBar onChange={setQuery} placeholder="Salon, area or service" value={query} />
      </Animated.View>

      {cities.length > 1 ? (
        <Animated.View entering={enterUp(2)}>
          <ScrollView contentContainerStyle={s.chips} horizontal showsHorizontalScrollIndicator={false}>
            <Chip label="All cities" onPress={() => setCity(ALL)} selected={city === ALL} />
            {cities.map((name) => (
              <Chip
                key={name}
                label={name}
                onPress={() => setCity(city === name ? ALL : name)}
                selected={city === name}
              />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <EmptyState
          actionLabel="Try again"
          body={error}
          onAction={load}
          title="Nothing loaded"
          tone="error"
        />
      ) : visible.length ? (
        <View>
          <Text style={s.count}>
            {visible.length} salon{visible.length === 1 ? "" : "s"}
          </Text>
          {visible.map((salon, index) => (
            <Animated.View entering={enterUp(index)} key={salon.id} layout={listTransition}>
              <SalonCard salon={salon} />
            </Animated.View>
          ))}
        </View>
      ) : (
        <EmptyState
          actionLabel={filtering ? "Clear filters" : undefined}
          body={
            filtering
              ? "Try another city, or search by salon name, area or service."
              : "No salon has been approved on BookBarber yet. Pull down to check again."
          }
          icon="salons"
          onAction={
            filtering
              ? () => {
                  setQuery("");
                  setCity(ALL);
                }
              : undefined
          }
          title={filtering ? "No salons match" : "No salons yet"}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { ...type.display, color: colors.text },
  sub: { ...type.body, color: colors.muted, marginTop: 6 },
  search: { marginTop: spacing.lg },
  chips: { gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.md, paddingBottom: 2 },
  count: { ...type.label, color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm },
});
