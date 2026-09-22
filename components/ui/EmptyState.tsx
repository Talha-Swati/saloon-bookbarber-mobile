import Animated from "react-native-reanimated";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Button } from "./Button";
import { Icon, IconName } from "./Icon";
import { enterUp } from "./motion";

type Props = {
  icon?: IconName;
  title: string;
  /** One sentence saying what to do next, not a restatement of the title. */
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Use for a failure the person can retry, which is tinted and offers the retry. */
  tone?: "neutral" | "error";
};

/**
 * What a screen shows when it has nothing to show.
 *
 * The screens previously ended an empty list with a single line of grey text —
 * "No upcoming bookings." — which reads as a dead end and, when it was actually a
 * network failure, was indistinguishable from "you have none". This separates the two
 * with `tone` and always offers the next action, so no empty screen is a cul-de-sac.
 */
export function EmptyState({ icon, title, body, actionLabel, onAction, tone = "neutral" }: Props) {
  const failed = tone === "error";
  return (
    <Animated.View entering={enterUp()} style={s.wrap}>
      <View style={[s.badge, failed && s.badgeError]}>
        <Icon
          color={failed ? colors.danger : colors.deepGreen}
          name={icon ?? (failed ? "warning" : "empty")}
          size={26}
        />
      </View>
      <Text style={s.title}>{title}</Text>
      {body ? <Text style={s.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          block={false}
          label={actionLabel}
          onPress={onAction}
          size="md"
          style={s.action}
          variant="secondary"
        />
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeError: { backgroundColor: colors.dangerSoft },
  title: { ...type.cardTitle, color: colors.text, marginTop: spacing.md, textAlign: "center" },
  body: {
    ...type.caption,
    color: colors.secondaryText,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 300,
  },
  action: { marginTop: spacing.lg },
});
