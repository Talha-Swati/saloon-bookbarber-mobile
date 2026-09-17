import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
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
        router.replace(isProfessional ? "/professional" : "/(tabs)/profile");
      } catch (e) {
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
        <Text style={s.title}>Something went missing</Text>
        <Text style={s.note}>We don&apos;t know which email to verify. Please sign up again.</Text>
        <Pressable onPress={() => router.replace("/auth/sign-up")} style={s.primary}>
          <Text style={s.primaryText}>Back to sign up</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>‹ Back</Text>
      </Pressable>

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

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={[s.timer, expired && s.timerExpired]}>
        {expired ? "Code expired" : `Expires in ${mmss(secondsLeft)}`}
      </Text>

      <Pressable
        disabled={busy || code.length !== CODE_LENGTH}
        onPress={() => submit(code)}
        style={[s.primary, (busy || code.length !== CODE_LENGTH) && s.disabled]}
      >
        {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryText}>Verify and continue</Text>}
      </Pressable>

      <Pressable disabled={resending} onPress={resend} style={s.link}>
        <Text style={s.linkText}>{resending ? "Sending…" : "Resend code"}</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.replace({
            pathname: "/auth/sign-in",
            params: isProfessional ? { entry: "professional" } : {},
          })
        }
        style={s.link}
      >
        <Text style={s.linkMuted}>Already verified? Sign in</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { color: colors.deepGreen, fontWeight: "700", marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  note: { color: colors.muted, marginTop: 8, marginBottom: spacing.lg, lineHeight: 21 },
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
  error: { color: colors.danger, marginBottom: spacing.sm, lineHeight: 20 },
  timer: { color: colors.muted, marginBottom: spacing.lg, fontWeight: "600" },
  timerExpired: { color: colors.danger },
  primary: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  link: { alignItems: "center", padding: spacing.md },
  linkText: { color: colors.deepGreen, fontWeight: "700" },
  linkMuted: { color: colors.muted, fontWeight: "600" },
});
