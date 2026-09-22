import { PropsWithChildren } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion } from "@/constants/theme";
import { haptics } from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PropsWithChildren<
  Omit<PressableProps, "style"> & {
    style?: StyleProp<ViewStyle>;
    /** How far the surface sinks on press. Smaller for big surfaces, larger for buttons. */
    scaleTo?: number;
    /** Set false on a surface that is pressed many times in a row, e.g. a stepper. */
    haptic?: boolean;
  }
>;

/**
 * The app's tappable surface.
 *
 * React Native's own press feedback is `opacity: 0.85`, which reads as the element
 * greying out rather than being pushed — and on a white card against a near-white
 * background it is close to invisible. A small scale is the gesture people actually
 * recognise as "this is a button and I have hold of it", it works on any background
 * colour, and it runs on the UI thread, so it still responds while the JS thread is busy
 * loading the screen the tap is about to open.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: motion.press });
        if (haptic && !disabled) haptics.tap();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, { duration: motion.fast });
        onPressOut?.(event);
      }}
      style={[style, animated]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
