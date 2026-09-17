import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/constants/theme";
import { fetchMaintenanceState } from "@/services/platformService";

/**
 * Holds the app behind a notice while the platform is in maintenance.
 *
 * The counterpart of the web client's middleware rewrite to /maintenance. Before this,
 * the super admin's maintenance toggle reached no customer surface at all: the website
 * and the app both carried on selling appointments.
 *
 * Deliberately NOT a blocking splash on first paint. The check is one small request and
 * the answer is almost always "no", so the app renders immediately and only swaps to the
 * notice if maintenance turns out to be on. A customer opening the app on a slow
 * connection sees their bookings, not a spinner waiting on a setting.
 *
 * Re-checked when the app returns to the foreground, which is how a customer who had it
 * open through the maintenance window finds out it is over without force-quitting.
 */
export function MaintenanceGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ enabled: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);

  // The quiet check: no `checking` state, so nothing is set synchronously when the effect
  // below runs. That matters for more than the lint rule - a spinner on the automatic
  // check would flash on every cold start and every return to the foreground, for a
  // question whose answer is almost always "no".
  const load = useCallback(async () => {
    setState(await fetchMaintenanceState());
  }, []);

  // The explicit one, behind the Try again button, where a person is waiting for an
  // answer and should be shown that something is happening.
  const retry = useCallback(async () => {
    setChecking(true);
    try {
      await load();
    } finally {
      setChecking(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void load();
    });
    return () => subscription.remove();
  }, [load]);

  if (!state?.enabled) return <>{children}</>;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.card}>
        <Text style={s.icon}>🛠</Text>
        <Text style={s.title}>We&rsquo;ll be right back</Text>
        <Text style={s.message}>{state.message}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={checking}
          onPress={() => void retry()}
          style={({ pressed }) => [s.button, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.buttonText}>{checking ? "Checking…" : "Try again"}</Text>
        </Pressable>
        <Text style={s.footnote}>
          Existing appointments are unaffected. Your salon still has them.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    width: "100%",
  },
  icon: { fontSize: 40 },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.md,
    textAlign: "center",
  },
  message: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonText: { color: colors.onPrimary, fontWeight: "700" },
  footnote: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
