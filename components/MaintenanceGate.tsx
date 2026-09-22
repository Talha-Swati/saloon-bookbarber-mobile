import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Button, Icon } from "@/components/ui";
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
        <View style={s.mark}>
          <Icon color={colors.warning} name="warning" size={28} />
        </View>
        <Text style={s.title}>BookBarber is being updated</Text>
        <Text style={s.message}>{state.message}</Text>
        <Button
          label="Try again"
          loading={checking}
          onPress={() => void retry()}
          style={s.button}
        />
        <Text style={s.footnote}>
          Appointments you have already booked are unaffected. Your salon still has them.
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
  mark: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.title, color: colors.text, marginTop: spacing.md, textAlign: "center" },
  message: {
    ...type.body,
    color: colors.secondaryText,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  button: { alignSelf: "stretch", marginTop: spacing.lg },
  footnote: {
    ...type.label,
    fontWeight: "400",
    color: colors.muted,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
