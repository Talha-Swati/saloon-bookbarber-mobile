import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing, type } from "@/constants/theme";
import { AppBar, Button, EmptyState, Notice, PressableScale, haptics } from "@/components/ui";
import {
  RegistrationRole,
  SIGNUP_CODE_TTL_SECONDS,
  resendSignupCode,
  signupCodeErrorMessage,
  verifySignupCode,
} from "@/services/authService";

const CODE_LENGTH = 6;

const mmss = (total: number) => {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string; fullName?: string; role?: string }>();
  const email = (params.email ?? "").trim();
  const fullName = params.fullName ?? "";
  const role: RegistrationRole = params.role === "professional" ? "professional" : "customer";
  const isProfessional = role === "professional";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SIGNUP_CODE_TTL_SECONDS);
  const inputRef = useRef<TextInput>(null);

  // One interval for the lifetime of the screen; restarted only when a new code is sent.
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const expired = secondsLeft === 0;

  const submit = useCallback(
    async (value: string) => {
      if (busy || value.length !== CODE_LENGTH) return;
      setBusy(true);
      setError("");
      try {
        await verifySignupCode({ email, code: value, fullName, role });
        haptics.success();
        router.replace(isProfessional ? "/professional" : "/(tabs)");
      } catch (e) {
        haptics.error();
        setError(signupCodeErrorMessage(e));
        setCode("");
      } finally {
        setBusy(false);
      }
    },
    [busy, email, fullName, role, isProfessional],
  );

  const onChange = (raw: string) => {
    // Digits only — people paste codes with stray spaces out of the email.
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError("");
    if (digits.length === CODE_LENGTH) submit(digits);
  };

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setError("");
    try {
      await resendSignupCode(email);
      setCode("");
      setSecondsLeft(SIGNUP_CODE_TTL_SECONDS);
      inputRef.current?.focus();
      Alert.alert("Code sent", `A new code is on its way to ${email}.`);
    } catch (e) {
      setError(signupCodeErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <Screen>
        <AppBar title="Verify your email" />
        <EmptyState
          actionLabel="Back to sign up"
          body="We do not know which email address to verify. Start the sign up again."
          onAction={() => router.replace("/auth/sign-up")}
          title="Something went missing"
          tone="error"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar onBack={() => router.back()} title="Verify your email" />

      <Text style={s.title}>Enter your code</Text>
      <Text style={s.note}>
        We sent a {CODE_LENGTH}-digit code to{"\n"}
        <Text style={s.email}>{email}</Text>
      </Text>

      {/* One hidden-ish input drives six boxes: a real six-input row fights autofill and
          backspace on Android, and paste only ever lands in one field. */}
      <Pressable onPress={() => inputRef.current?.focus()} style={s.boxRow}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <View key={i} style={[s.box, code.length === i && s.boxActive, Boolean(error) && s.boxError]}>
            <Text style={s.boxText}>{code[i] ?? ""}</Text>
          </View>
        ))}
      </Pressable>

      <TextInput
        autoFocus
        caretHidden
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        onChangeText={onChange}
        ref={inputRef}
        style={s.hiddenInput}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        value={code}
      />

      {error ? (
        <View style={s.error}>
          <Notice body={error} title="That code did not work" tone="danger" />
        </View>
      ) : null}

      <Text style={[s.timer, expired && s.timerExpired]}>
        {expired ? "Code expired" : `Expires in ${mmss(secondsLeft)}`}
      </Text>

      <Button
        disabled={code.length !== CODE_LENGTH}
        label="Verify and continue"
        loading={busy}
        onPress={() => submit(code)}
      />

      <Button
        label="Send a new code"
        loading={resending}
        onPress={resend}
        style={s.resend}
        variant="secondary"
      />

      <PressableScale
        onPress={() =>
          router.replace({
            pathname: "/auth/sign-in",
            params: isProfessional ? { entry: "professional" } : {},
          })
        }
        scaleTo={0.97}
        style={s.link}
      >
        <Text style={s.linkMuted}>Already verified? Sign in</Text>
      </PressableScale>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { ...type.display, color: colors.text, marginTop: spacing.md },
  note: { ...type.body, color: colors.muted, marginTop: 8, marginBottom: spacing.lg },
  email: { color: colors.text, fontWeight: "700" },
  boxRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  boxText: { color: colors.text, fontSize: 24, fontWeight: "800" },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  error: { marginBottom: spacing.md },
  timer: { ...type.caption, fontWeight: "700", color: colors.muted, marginBottom: spacing.lg },
  timerExpired: { color: colors.danger },
  resend: { marginTop: spacing.sm },
  link: { alignItems: "center", padding: spacing.md, marginTop: spacing.sm },
  linkMuted: { ...type.caption, fontWeight: "700", color: colors.muted },
});
