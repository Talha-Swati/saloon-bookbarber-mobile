import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { colors, motion, radius, spacing, type } from "@/constants/theme";

/**
 * How far through a flow the person is.
 *
 * It replaces a row of numbered circles, which had two problems. A row of digits makes
 * someone count to work out where they are, and "3" tells you nothing about what step 3
 * is — so the flow felt longer than it was. A filling bar is read at a glance, and
 * naming the current step ("Step 2 of 3 · Confirm") answers "what am I doing" and "how
 * much is left" in one line.
 */
export function StepProgress({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  const fill = useAnimatedStyle(() => ({
    width: withTiming(`${Math.min(100, (step / total) * 100)}%`, { duration: motion.enter }),
  }));

  return (
    <View accessibilityLabel={`Step ${step} of ${total}: ${label}`} style={s.wrap}>
      <View style={s.track}>
        <Animated.View style={[s.fill, fill]} />
      </View>
      <Text style={s.caption}>
        Step {step} of {total} · <Text style={s.current}>{label}</Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.lg },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  caption: { ...type.label, fontWeight: "400", color: colors.muted },
  current: { color: colors.deepGreen, fontWeight: "800" },
});
