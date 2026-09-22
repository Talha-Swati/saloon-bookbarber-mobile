import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, elevation, radius, spacing } from "@/constants/theme";
import { PressableScale } from "./Pressable";

type Props = PropsWithChildren<{
  onPress?: () => void;
  /** `raised` floats off the background; `flat` sits on it behind a hairline border. */
  tone?: "flat" | "raised";
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Turn off when the card supplies its own edge-to-edge content, e.g. a cover. */
  padded?: boolean;
}>;

/** The container every list row, panel and selectable option is built from. */
export function Card({
  children,
  onPress,
  tone = "flat",
  selected = false,
  style,
  accessibilityLabel,
  padded = true,
}: Props) {
  const composed = [
    s.card,
    padded && s.padded,
    tone === "raised" ? elevation.md : s.bordered,
    selected && s.selected,
    style,
  ];
  if (!onPress) return <View style={composed}>{children}</View>;
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={composed}
    >
      {children}
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" },
  padded: { padding: spacing.md },
  bordered: { borderWidth: 1, borderColor: colors.border },
  selected: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
