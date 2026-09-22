import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { colors, elevation, radius, spacing, type } from "@/constants/theme";
import { PressableScale } from "./Pressable";
import { haptics } from "./motion";

type Option<T extends string> = { value: T; label: string; count?: number };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * The filter control for My Bookings and a barber's day.
 *
 * The white thumb slides between segments rather than the selection simply appearing on
 * the tapped one. That is not decoration: the movement is what tells a person the three
 * segments are one control showing one list, which the previous three separate outlined
 * buttons did not — they read as three independent toggles that might each be on.
 *
 * `count` is rendered when supplied, so "Upcoming 2" answers how many there are before
 * the tab is opened.
 */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width ? (width - 8) / options.length : 0;

  const thumb = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(segment * index, { damping: 18, mass: 0.6 }) }],
  }));

  const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={measure} style={s.track}>
      {width > 0 ? <Animated.View style={[s.thumb, thumb]} /> : null}
      {options.map((option) => {
        const on = option.value === value;
        return (
          <PressableScale
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            haptic={false}
            key={option.value}
            onPress={() => {
              if (on) return;
              haptics.select();
              onChange(option.value);
            }}
            scaleTo={0.96}
            style={s.segment}
          >
            <Text numberOfLines={1} style={[s.label, on && s.labelOn]}>
              {option.label}
              {option.count ? ` ${option.count}` : ""}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.md,
    padding: 4,
  },
  thumb: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    ...elevation.sm,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  label: { ...type.caption, fontWeight: "700", color: colors.secondaryText },
  labelOn: { color: colors.text },
});
