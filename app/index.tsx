import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";

export default function RoleGateway() {
  return (
    <Screen>
      <View style={s.content}>
        <Text style={s.eyebrow}>BOOKBARBER</Text>
        <Text style={s.title}>Continue as</Text>
        <Text style={s.subtitle}>
          Choose how you want to use BookBarber today.
        </Text>
        <Pressable style={s.primary} onPress={() => router.replace("/(tabs)")}>
          <Text style={s.primaryTitle}>Customer</Text>
          <Text style={s.primaryBody}>Discover salons and manage bookings</Text>
        </Pressable>
        <Pressable
          style={s.secondary}
          onPress={() => router.push("/professional")}
        >
          <Text style={s.secondaryTitle}>Professional</Text>
          <Text style={s.secondaryBody}>
            For barbers, stylists, beauticians and specialists
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { flex: 1, justifyContent: "center" },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, marginBottom: spacing.xl },
  primary: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  primaryTitle: { color: colors.onPrimary, fontSize: 20, fontWeight: "800" },
  primaryBody: { color: colors.primarySoft, marginTop: 6 },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg },
  secondaryTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  secondaryBody: { color: colors.muted, lineHeight: 20, marginTop: 6 },
});
