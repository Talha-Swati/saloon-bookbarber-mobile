import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/constants/theme";
import { Icon } from "./ui/Icon";
import { PressableScale } from "./ui/Pressable";

type Props = {
  title: string;
  /** One short line under the title, when the title alone does not say enough. */
  subtitle?: string;
  action?: string;
  /**
   * Required whenever `action` is set. The action used to be plain text styled to look
   * like a link with nothing behind it — "View salons" sat on the home screen looking
   * tappable and did nothing. Making the handler mandatory alongside the label is what
   * stops that being possible again.
   */
  onAction?: () => void;
};

export function SectionHeader({ title, subtitle, action, onAction }: Props) {
  return (
    <View style={s.row}>
      <View style={s.text}>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <PressableScale
          accessibilityLabel={action}
          hitSlop={8}
          onPress={onAction}
          scaleTo={0.94}
          style={s.action}
        >
          <Text style={s.actionText}>{action}</Text>
          <Icon color={colors.deepGreen} name="forward" size={14} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  text: { flex: 1 },
  title: { ...type.section, color: colors.text },
  subtitle: { ...type.caption, color: colors.muted, marginTop: 3 },
  action: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6 },
  actionText: { ...type.caption, fontWeight: "800", color: colors.deepGreen },
});
