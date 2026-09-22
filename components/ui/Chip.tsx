import { StyleSheet, Text } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Icon, IconName } from "./Icon";
import { PressableScale } from "./Pressable";
import { haptics } from "./motion";

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  /** Secondary line inside the chip, e.g. the date under a weekday. */
  sublabel?: string;
};

/** A single-tap filter or option. Used for dates, time slots and service categories. */
export function Chip({ label, selected = false, onPress, icon, disabled, sublabel }: Props) {
  return (
    <PressableScale
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      haptic={false}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      scaleTo={0.94}
      style={[s.chip, sublabel ? s.stacked : null, selected && s.on, disabled && s.off]}
    >
      {icon ? (
        <Icon color={selected ? colors.deepGreen : colors.secondaryText} name={icon} size={15} />
      ) : null}
      <Text style={[s.text, selected && s.textOn]}>{label}</Text>
      {sublabel ? <Text style={[s.sub, selected && s.textOn]}>{sublabel}</Text> : null}
    </PressableScale>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stacked: {
    flexDirection: "column",
    gap: 2,
    minWidth: 76,
    minHeight: 62,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  on: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  off: { opacity: 0.4 },
  text: { ...type.caption, fontWeight: "700", color: colors.secondaryText },
  sub: { ...type.label, fontWeight: "800", color: colors.text },
  textOn: { color: colors.deepGreen },
});
