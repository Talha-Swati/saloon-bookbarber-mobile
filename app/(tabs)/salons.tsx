import { StyleSheet, Text, TextInput, View } from "react-native";
import { SalonCard } from "@/components/SalonCard";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchSalons } from "@/services/salonService";
import { Salon } from "@/types";
export default function Salons() {
  const [items, setItems] = useState<Salon[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchSalons()
      .then(setItems)
      .catch(() => setError("Unable to load salons."))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(load);
  const visible = items.filter((x) =>
    `${x.name} ${x.area} ${x.city}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Screen>
      <Text style={s.title}>Find a salon</Text>
      <Text style={s.sub}>
        Choose a salon, then select a service and available slot.
      </Text>
      <View style={s.search}>
        <Text>?</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1, minHeight: 50 }}
          placeholder="Salon name or area"
          placeholderTextColor={colors.muted}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <State text={error} retry={load} />
      ) : visible.length ? (
        visible.map((x) => <SalonCard key={x.id} salon={x} />)
      ) : (
        <State text="No salons available yet." />
      )}
    </Screen>
  );
}
function State({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <View style={s.state}>
      <Text style={s.stateText}>{text}</Text>
      {retry && (
        <Pressable onPress={retry}>
          <Text style={s.retry}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  sub: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  state: { alignItems: "center", padding: spacing.xl },
  stateText: { color: colors.muted, textAlign: "center" },
  retry: { color: colors.deepGreen, fontWeight: "800", marginTop: spacing.md },
});
