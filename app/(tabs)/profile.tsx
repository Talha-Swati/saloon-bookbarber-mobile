import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
const menu = [
  "Personal information",
  "Saved salons",
  "Help & support",
  "About BookBarber",
];
import { useState } from "react";
import { Alert, ActivityIndicator, TextInput } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { signIn } from "@/services/authService";
import { router } from "expo-router";
export default function Profile() {
  const { session: activeSession, role, loading, configured, demoBypassEnabled, signInDemo, signOut } = useAuth();
  const session = role === "customer" ? activeSession : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!demoBypassEnabled && (!email.trim() || password.length < 6)) {
      Alert.alert(
        "Check your details",
        "Enter an email and a password of at least 6 characters.",
      );
      return;
    }
    setBusy(true);
    try {
      if (demoBypassEnabled) await signInDemo("customer");
      else await signIn(email, password);
    } catch (e) {
      Alert.alert(
        "Authentication failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  return (
    <Screen>
      <Text style={s.title}>Profile</Text>
      {session ? (
        <>
          <View style={s.profile}>
            <View style={s.avatar}>
              <Text style={s.initials}>
                {session.user.email?.[0].toUpperCase() ?? "U"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>Customer</Text>
              <Text style={s.muted}>{session.user.email}</Text>
            </View>
          </View>
          <Pressable
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await signOut();
              } catch (e) {
                Alert.alert(
                  "Logout failed",
                  e instanceof Error ? e.message : "Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
            style={s.primary}
          >
            <Text style={s.primaryText}>
              {busy ? "Signing out…" : "Logout"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={s.note}>
            {demoBypassEnabled
              ? "Sign in to enter the customer demo."
              : configured
              ? "Sign in to create and view bookings."
              : "Add the Supabase public environment variables, then restart Expo."}
          </Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          <Pressable
            disabled={busy || (!configured && !demoBypassEnabled)}
            onPress={submit}
            style={[s.primary, ((!configured && !demoBypassEnabled) || busy) && { opacity: 0.45 }]}
          >
            <Text style={s.primaryText}>
              {busy ? "Please wait…" : "Sign in"}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy || !configured}
            onPress={() => router.push("/auth/sign-up")}
            style={s.secondary}
          >
            <Text style={s.secondaryText}>Create account</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.onPrimary, fontSize: 20, fontWeight: "800" },
  name: { color: colors.text, fontSize: 20, fontWeight: "700" },
  muted: { color: colors.muted, marginTop: 4 },
  note: { color: colors.muted, lineHeight: 20, marginVertical: spacing.lg },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  primary: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  secondary: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  secondaryText: { color: colors.deepGreen, fontWeight: "800" },
});
