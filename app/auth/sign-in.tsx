import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { AppBar, Button, Field, Icon, Notice, PressableScale, enterUp, haptics } from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { signIn } from "@/services/authService";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";

const EMAIL = /^\S+@\S+\.\S+$/;

export default function SignIn() {
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const professionalEntry = entry === "professional";
  const { demoBypassEnabled, signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!demoBypassEnabled) {
      // Validated per field and shown under the field, rather than in an Alert that
      // covers the form and does not say which box is wrong.
      const next: typeof errors = {};
      if (!EMAIL.test(email.trim())) next.email = "Enter the email address you signed up with.";
      if (!password) next.password = "Enter your password.";
      setErrors(next);
      if (Object.keys(next).length) {
        haptics.warn();
        return;
      }
    }
    setBusy(true);
    setFormError("");
    try {
      if (demoBypassEnabled) {
        await signInDemo(professionalEntry ? "professional" : "customer");
        router.replace(professionalEntry ? "/professional" : "/(tabs)");
        return;
      }

      const { role } = await signIn(email, password);

      // Routed by what the account IS, not by which entry button was tapped. `entry`
      // only decides the wording on the way in; it is not evidence about the account.
      if (role === "professional") {
        haptics.success();
        router.replace("/professional");
        return;
      }
      if (role === "salon_admin" || role === "super_admin") {
        // This app has customer and barber screens only. Signing them out is kinder
        // than dropping them into a customer session where RLS returns nothing and the
        // Book button would create bookings under an admin account.
        await supabase.auth.signOut();
        Alert.alert(
          "Use the web console",
          "This is a salon administrator account. Manage bookings from the BookBarber admin console in a browser — the app is for customers and barbers.",
        );
        return;
      }
      haptics.success();
      router.replace("/(tabs)");
    } catch (error) {
      haptics.error();
      setFormError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppBar onBack={() => router.back()} title="Sign in" />

      <Animated.View entering={enterUp()} style={s.head}>
        <View style={s.mark}>
          <Icon color={colors.deepGreen} name={professionalEntry ? "briefcase" : "person"} size={26} />
        </View>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.sub}>
          {professionalEntry
            ? "Sign in with the account your salon set up for you."
            : "Sign in to book, and to see the appointments you already have."}
        </Text>
      </Animated.View>

      {formError ? (
        <View style={s.notice}>
          <Notice body={formError} title="We could not sign you in" tone="danger" />
        </View>
      ) : null}

      <Animated.View entering={enterUp(1)}>
        <Field
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
          icon="mail"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          placeholder="you@example.com"
          value={email}
        />
        <Field
          autoComplete="current-password"
          error={errors.password}
          icon="lock"
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) setErrors({ ...errors, password: undefined });
          }}
          onSubmitEditing={submit}
          password
          placeholder="Your password"
          returnKeyType="go"
          value={password}
        />
      </Animated.View>

      <Animated.View entering={enterUp(2)}>
        <Button label="Sign in" loading={busy} onPress={submit} />
        <PressableScale
          disabled={busy}
          onPress={() =>
            router.replace({
              pathname: "/auth/sign-up",
              params: professionalEntry ? { role: "professional" } : {},
            })
          }
          scaleTo={0.97}
          style={s.link}
        >
          <Text style={s.linkText}>
            New here? <Text style={s.linkStrong}>Create an account</Text>
          </Text>
        </PressableScale>
      </Animated.View>

      {/*
        The way across between the two halves of the app, in both directions.

        The first-launch welcome asks once and never returns, so without this a barber who
        tapped "I want to book" — or who reinstalled and tapped past it — would have no
        route to their workspace from the screen they are most likely to be standing on.
        It points the other way too, because a customer who arrived through a barber's
        recommendation can land on the professional screen just as easily.
      */}
      <PressableScale
        accessibilityLabel={
          professionalEntry ? "Sign in as a customer instead" : "Sign in as a professional instead"
        }
        disabled={busy}
        onPress={() =>
          router.replace({
            pathname: "/auth/sign-in",
            params: professionalEntry ? {} : { entry: "professional" },
          })
        }
        scaleTo={0.97}
        style={s.cross}
      >
        <Icon color={colors.deepGreen} name={professionalEntry ? "person" : "briefcase"} size={16} />
        <Text style={s.crossText}>
          {professionalEntry ? "I am a customer" : "I work at a salon"}
        </Text>
      </PressableScale>

      {/*
        Password reset exists on the website only — nothing in either repo can send mail,
        so an in-app "reset password" button would open a flow with no delivery path.
        Saying where it does work is more use than a button that cannot finish.
      */}
      <Text style={s.help}>
        Forgotten your password? Reset it on the BookBarber website, then sign in here.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { alignItems: "center", paddingVertical: spacing.lg },
  mark: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.title, color: colors.text, marginTop: spacing.md },
  sub: {
    ...type.body,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  notice: { marginBottom: spacing.md },
  link: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  linkText: { ...type.caption, color: colors.secondaryText },
  linkStrong: { color: colors.deepGreen, fontWeight: "800" },
  cross: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.lg,
  },
  crossText: { ...type.caption, fontWeight: "800", color: colors.deepGreen },
  help: {
    ...type.label,
    fontWeight: "400",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.lg,
  },
});
