import { StyleSheet, Text, View } from "react-native";
import { colors, radius, type } from "@/constants/theme";
import { Icon, IconName } from "./Icon";

/**
 * Four tones, each a foreground and background designed together.
 *
 * `live` is work still ahead, `done` is finished, `stopped` is cancelled or missed, and
 * `pending` is waiting on somebody. The icon is not decoration: a pill that says its
 * meaning only through colour is unreadable to a colour-blind customer, and these pills
 * carry booking status, which is the one thing on the screen that must not be guessed at.
 */
export type PillTone = "live" | "done" | "stopped" | "pending";

const tones: Record<PillTone, { fg: string; bg: string; icon: IconName }> = {
  live: { fg: colors.deepGreen, bg: colors.primarySoft, icon: "checkCircle" },
  done: { fg: colors.secondaryText, bg: colors.neutralSoft, icon: "check" },
  stopped: { fg: colors.danger, bg: colors.dangerSoft, icon: "cancelled" },
  pending: { fg: colors.warning, bg: colors.warningSoft, icon: "clock" },
};

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const { fg, bg, icon } = tones[tone];
  return (
    <View accessibilityLabel={`Status: ${label}`} style={[s.pill, { backgroundColor: bg }]}>
      <Icon color={fg} name={icon} size={12} />
      <Text style={[s.text, { color: fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  text: { ...type.label, fontSize: 10, letterSpacing: 0.4 },
});
