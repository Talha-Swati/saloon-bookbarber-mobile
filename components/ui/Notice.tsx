import Animated from "react-native-reanimated";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Icon, IconName } from "./Icon";
import { enterUp } from "./motion";

type Tone = "info" | "warning" | "danger" | "success";

const tones: Record<Tone, { fg: string; bg: string; border: string; icon: IconName }> = {
  info: { fg: "#1E40AF", bg: colors.infoSoft, border: "#BFD3FB", icon: "info" },
  warning: { fg: colors.warning, bg: colors.warningSoft, border: "#F5C77E", icon: "warning" },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: "#F3B9B9", icon: "warning" },
  success: { fg: colors.deepGreen, bg: colors.primarySoft, border: colors.primary, icon: "checkCircle" },
};

/**
 * An inline message about the screen it sits on — test-mode payments, a barber's leave,
 * a failed action.
 *
 * Deliberately not a toast or an `Alert`: both of those disappear, and every message
 * this replaces is one a person may need to read twice, or read again after scrolling
 * back. It is also not four hand-tinted `#FFFBEB` blocks, which is what it replaces.
 */
export function Notice({
  tone = "info",
  title,
  body,
}: {
  tone?: Tone;
  title: string;
  body?: string;
}) {
  const palette = tones[tone];
  return (
    <Animated.View
      accessibilityRole="alert"
      entering={enterUp()}
      style={[s.wrap, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Icon color={palette.fg} name={palette.icon} size={18} />
      <View style={s.text}>
        <Text style={[s.title, { color: palette.fg }]}>{title}</Text>
        {body ? <Text style={[s.body, { color: palette.fg }]}>{body}</Text> : null}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  text: { flex: 1 },
  title: { ...type.label, fontSize: 13 },
  body: { ...type.caption, fontSize: 12, marginTop: 4, opacity: 0.92 },
});
