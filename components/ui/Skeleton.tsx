import { useEffect } from "react";
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, radius, spacing } from "@/constants/theme";

/**
 * A pulsing placeholder in the shape of the thing that is loading.
 *
 * It replaces a centred `ActivityIndicator`, which has two costs a spinner cannot avoid:
 * it says nothing about what is coming, and the moment it is swapped out the whole screen
 * jumps, because no layout was ever reserved. A skeleton holds the space, so the content
 * fades in where the eye is already looking.
 */
export function Skeleton({
  width = "100%",
  height = 14,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 650 }), withTiming(0.45, { duration: 650 })),
      -1,
      true,
    );
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: Math.min(height / 2, radius.sm), backgroundColor: colors.border },
        animated,
        style,
      ]}
    />
  );
}

/** The salon / booking card skeleton, so discovery and My Bookings load the same way. */
export function CardSkeleton({ lines = 2, cover = false }: { lines?: number; cover?: boolean }) {
  return (
    <View style={s.card}>
      {cover ? <Skeleton height={108} style={s.cover} /> : null}
      <View style={s.body}>
        <Skeleton height={18} width="62%" />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} height={12} width={i === lines - 1 ? "40%" : "85%"} />
        ))}
      </View>
    </View>
  );
}

/** A run of card skeletons. `count` should match how many rows usually come back. */
export function SkeletonList({
  count = 3,
  ...rest
}: {
  count?: number;
  lines?: number;
  cover?: boolean;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} {...rest} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  cover: { borderRadius: 0 },
  body: { padding: spacing.md, gap: spacing.sm },
});
