import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Icon, IconName } from "./Icon";
import { PressableScale } from "./Pressable";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "md" | "lg";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Shows a spinner and blocks the press. Use for anything that hits the network. */
  loading?: boolean;
  disabled?: boolean;
  /** Fills the row it is in. Default for `lg`, off for `md`. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * One button, four variants — replacing the fourteen near-identical `s.primary` /
 * `s.secondary` / `s.destructive` blocks that were copied screen to screen and had
 * already drifted: min-heights of 46, 48, 50 and 52 across five files, and two different
 * disabled opacities.
 *
 * `loading` is a first-class prop rather than something each caller swaps the label for,
 * because the pattern it replaces — `{busy ? "Signing out…" : "Logout"}` — changes the
 * button's width mid-press, which moves everything under it.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  loading = false,
  disabled = false,
  block = size === "lg",
  style,
  accessibilityHint,
}: Props) {
  const blocked = disabled || loading;
  const tint =
    variant === "primary"
      ? colors.onPrimary
      : variant === "destructive"
        ? colors.danger
        : colors.deepGreen;

  return (
    <PressableScale
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      scaleTo={0.96}
      style={[
        s.base,
        size === "md" ? s.md : s.lg,
        block && s.block,
        s[variant],
        blocked && s.blocked,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <View style={s.content}>
          {icon ? <Icon color={tint} name={icon} size={18} /> : null}
          <Text style={[s.label, { color: tint }]}>{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  md: { minHeight: 44 },
  lg: { minHeight: 52 },
  block: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...type.bodyStrong, fontWeight: "800" },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.danger },
  blocked: { opacity: 0.45 },
});
