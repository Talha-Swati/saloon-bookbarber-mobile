import { StyleSheet, TextInput, View } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Icon } from "./Icon";
import { PressableScale } from "./Pressable";

/**
 * The one search field, used by Home and Salons.
 *
 * It adds the clear button the two hand-built copies did not have: search on this screen
 * filters the whole list, so a stale term shows "no salons match" on a screen that has
 * plenty, and the only way out was to backspace through it.
 */
export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.bar}>
      <Icon color={colors.muted} name="search" size={19} />
      <TextInput
        accessibilityLabel={placeholder}
        autoCorrect={false}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={s.input}
        value={value}
      />
      {value.length > 0 ? (
        <PressableScale
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={() => onChange("")}
          scaleTo={0.85}
        >
          <Icon color={colors.muted} name="close" size={18} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minHeight: 52, ...type.body, color: colors.text },
});
