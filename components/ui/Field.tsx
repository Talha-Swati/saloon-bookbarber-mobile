import { useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, spacing, type } from "@/constants/theme";
import { Icon, IconName } from "./Icon";
import { PressableScale } from "./Pressable";

type Props = TextInputProps & {
  label: string;
  /** Shown under the field in red. The field's border turns red with it. */
  error?: string;
  /** Shown under the field in grey when there is no error. */
  hint?: string;
  icon?: IconName;
  /** Adds the show/hide control. Do not also pass `secureTextEntry`. */
  password?: boolean;
};

/**
 * A labelled text input.
 *
 * Every form in the app used a bare `TextInput` whose only label was its placeholder —
 * which disappears the moment someone types, so a half-filled form no longer says what
 * its fields are. Validation was `Alert.alert` on submit, which dismisses the keyboard,
 * covers the form, and does not point at the field it is about. The label stays, and
 * `error` is attached to the field that is wrong.
 */
export function Field({ label, error, hint, icon, password, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.box, focused && s.focused, Boolean(error) && s.invalid]}>
        {icon ? <Icon color={focused ? colors.deepGreen : colors.muted} name={icon} size={18} /> : null}
        <TextInput
          accessibilityLabel={label}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          placeholderTextColor={colors.muted}
          secureTextEntry={password && !revealed}
          style={[s.input, style]}
          {...rest}
        />
        {password ? (
          <PressableScale
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={10}
            onPress={() => setRevealed((value) => !value)}
            scaleTo={0.85}
          >
            <Icon color={colors.muted} name={revealed ? "eyeOff" : "eye"} size={18} />
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <Text style={s.error}>{error}</Text>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...type.label, color: colors.secondaryText, marginBottom: 6 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 52, ...type.body, color: colors.text },
  error: { ...type.label, fontWeight: "400", color: colors.danger, marginTop: 6 },
  hint: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: 6 },
});
