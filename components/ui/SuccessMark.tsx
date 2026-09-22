import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, motion, radius } from "@/constants/theme";
import { Icon } from "./Icon";
import { haptics } from "./motion";

/**
 * The confirmed-booking mark.
 *
 * This is the one place in the app that gets an emphasis animation, and it earns it:
 * it is the end of a five-screen flow the customer has just paid at, and the moment they
 * are looking for reassurance that it worked. A ring expands behind a tick that springs
 * in, with a success haptic on the same beat — the two together read as "done" faster
 * than any sentence does, and the sentence is still underneath it.
 */
export function SuccessMark() {
  const scale = useSharedValue(0.4);
  const ring = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.12, { damping: 9, mass: 0.5 }),
      withSpring(1, { damping: 14 }),
    );
    ring.value = withDelay(60, withTiming(1, { duration: motion.emphasis }));
    haptics.success();
  }, [ring, scale]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ring.value,
    transform: [{ scale: 1 + ring.value * 0.9 }],
  }));

  return (
    <View accessibilityElementsHidden style={s.wrap}>
      <Animated.View style={[s.ring, ringStyle]} />
      <Animated.View style={[s.mark, markStyle]}>
        <Icon color={colors.deepGreen} name="check" size={40} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  mark: {
    width: 78,
    height: 78,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
