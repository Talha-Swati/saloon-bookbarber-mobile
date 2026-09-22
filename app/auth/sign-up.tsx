import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { AppBar, Button, Field, Notice, PressableScale, enterUp, haptics } from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { RegistrationRole, signUp } from "@/services/authService";

const EMAIL = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;

type Errors = Partial<Record<"fullName" | "email" | "password" | "confirmPassword", string>>;

/** How strong the password is, in the three words a person can act on. */
function strengthOf(password: string): { label: string; score: number; tone: string } {
  if (password.length < MIN_PASSWORD) return { label: "Too short", score: 0.25, tone: colors.danger };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (variety >= 3 && password.length >= 12) return { label: "Strong", score: 1, tone: colors.deepGreen };
  if (variety >= 2) return { label: "Good", score: 0.65, tone: colors.warning };
  return { label: "Weak", score: 0.4, tone: colors.warning };
}

export default function SignUp() {
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role: RegistrationRole = roleParam === "professional" ? "professional" : "customer";
  const isProfessional = role === "professional";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined }));

  const submit = async () => {
    const next: Errors = {};
    if (fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!EMAIL.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (password !== confirmPassword) next.confirmPassword = "Both passwords must match.";
    setErrors(next);
    if (Object.keys(next).length) {
      haptics.warn();
      return;
    }

    setBusy(true);
    setFormError("");
    try {
      const outcome = await signUp(fullName, email, password, role);
      // Verification required: the account exists, so continue into the code screen
      // instead of reporting a failure the person cannot act on. fullName and role ride
      // along because the profiles row can only be written once the code is verified and
      // a real session exists.
      if (outcome.status === "confirm_email") {
        router.replace({
          pathname: "/auth/verify-email",
          params: { email: outcome.email, fullName: fullName.trim(), role },
        });
        return;
      }
      haptics.success();
      router.replace(isProfessional ? "/professional" : "/(tabs)");
    } catch (error) {
      haptics.error();
      setFormError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const strength = password ? strengthOf(password) : null;

  return (
    <Screen>
      <AppBar onBack={() => router.back()} title="Create account" />

      <Animated.View entering={enterUp()} style={s.head}>
        <Text style={s.title}>
          {isProfessional ? "Create a professional account" : "Create your account"}
        </Text>
        <Text style={s.sub}>
          {isProfessional
            ? "Your salon links this account to your chair, and your assigned appointments appear in it."
            : "One account holds your bookings, so you can check, change or cancel any of them."}
        </Text>
      </Animated.View>

      {formError ? (
        <View style={s.notice}>
          <Notice body={formError} title="We could not create the account" tone="danger" />
        </View>
      ) : null}

      <Animated.View entering={enterUp(1)}>
        <Field
          autoCapitalize="words"
          autoComplete="name"
          error={errors.fullName}
          icon="person"
          label="Full name"
          onChangeText={(value) => {
            setFullName(value);
            clear("fullName");
          }}
          placeholder="e.g. Ali Raza"
          value={fullName}
        />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
          icon="mail"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            clear("email");
          }}
          placeholder="you@example.com"
          value={email}
        />
        <Field
          autoComplete="new-password"
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
          icon="lock"
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            clear("password");
          }}
          password
          placeholder="Choose a password"
          value={password}
        />
        {/* Shown while typing rather than judged on submit. A rule someone only learns
            about after the form is rejected is a rule that costs a round trip. */}
        {strength ? (
          <View style={s.strength}>
            <View style={s.strengthTrack}>
              <View
                style={[
                  s.strengthFill,
                  { width: `${strength.score * 100}%`, backgroundColor: strength.tone },
                ]}
              />
            </View>
            <Text style={[s.strengthLabel, { color: strength.tone }]}>{strength.label}</Text>
          </View>
        ) : null}
        <Field
          autoComplete="new-password"
          error={errors.confirmPassword}
          icon="lock"
          label="Confirm password"
          onChangeText={(value) => {
            setConfirmPassword(value);
            clear("confirmPassword");
          }}
          onSubmitEditing={submit}
          password
          placeholder="Type it again"
          returnKeyType="go"
          value={confirmPassword}
        />
      </Animated.View>

      <Animated.View entering={enterUp(2)}>
        <Button
          label={isProfessional ? "Create professional account" : "Create account"}
          loading={busy}
          onPress={submit}
        />
        <PressableScale
          disabled={busy}
          onPress={() =>
            router.replace({
              pathname: "/auth/sign-in",
              params: isProfessional ? { entry: "professional" } : {},
            })
          }
          scaleTo={0.97}
          style={s.link}
        >
          <Text style={s.linkText}>
            Already have an account? <Text style={s.linkStrong}>Sign in</Text>
          </Text>
        </PressableScale>
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { paddingVertical: spacing.lg },
  title: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.secondaryText, marginTop: spacing.sm },
  notice: { marginBottom: spacing.md },
  strength: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
  strengthTrack: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
  strengthFill: { height: 5, borderRadius: radius.pill },
  strengthLabel: { ...type.label, fontSize: 11 },
  link: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  linkText: { ...type.caption, color: colors.secondaryText },
  linkStrong: { color: colors.deepGreen, fontWeight: "800" },
});
