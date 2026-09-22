import { ReactNode } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { HIT_SIZE, colors, spacing, type } from "@/constants/theme";
import { Icon } from "./Icon";
import { PressableScale } from "./Pressable";

type Props = {
  title?: string;
  /** Defaults to `router.back()`. Pass a function to leave a flow somewhere specific. */
  onBack?: () => void;
  /** Hides the back control on a screen that is the root of its stack. */
  showBack?: boolean;
  right?: ReactNode;
};

/**
 * One header for every pushed screen.
 *
 * It replaces seven hand-rolled copies that had drifted into four different back-glyph
 * sizes (34, 36 and two unstyled), three title sizes, and touch targets as small as
 * 36×36 — under the 48dp both platforms require. The back control is a real button with
 * a label, so a screen reader announces it instead of reading out the character "‹".
 */
export function AppBar({ title, onBack, showBack = true, right }: Props) {
  return (
    <View style={s.bar}>
      {showBack ? (
        <PressableScale
          accessibilityLabel="Go back"
          hitSlop={6}
          onPress={onBack ?? (() => router.back())}
          scaleTo={0.88}
          style={s.control}
        >
          <Icon color={colors.text} name="back" size={24} />
        </PressableScale>
      ) : (
        <View style={s.control} />
      )}
      <Text numberOfLines={1} style={s.title}>
        {title}
      </Text>
      <View style={s.control}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  control: { width: HIT_SIZE, height: HIT_SIZE, alignItems: "center", justifyContent: "center" },
  title: { ...type.cardTitle, color: colors.text, flex: 1, textAlign: "center" },
});
