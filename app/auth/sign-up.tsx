import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { RegistrationRole, signUp } from "@/services/authService";

export default function SignUp() {
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role: RegistrationRole =
    roleParam === "professional" ? "professional" : "customer";
  const isProfessional = role === "professional";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (fullName.trim().length < 2) return Alert.alert("Check your name", "Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert("Check your email", "Enter a valid email address.");
    if (password.length < 8) return Alert.alert("Password too short", "Use at least 8 characters.");
    if (password !== confirmPassword) return Alert.alert("Passwords do not match", "Re-enter the same password in both fields.");
    setBusy(true);
    try {
      const outcome = await signUp(fullName, email, password, role);
      // Verification required: the account exists, so continue into the PIN screen
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
      router.replace(
        isProfessional ? "/professional" : "/(tabs)/profile",
      );
    } catch (error) {
      Alert.alert("Unable to create account", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
      <Text style={s.title}>Create account</Text>
      <Text style={s.note}>
        Set up your {isProfessional ? "Professional" : "customer"} account.
      </Text>
      <TextInput autoCapitalize="words" value={fullName} onChangeText={setFullName} placeholder="Full Name" placeholderTextColor={colors.muted} style={s.input} />
      <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={s.input} />
      <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} style={s.input} />
      <TextInput secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password" placeholderTextColor={colors.muted} style={s.input} />
      <Pressable disabled={busy} onPress={submit} style={[s.primary, busy && s.disabled]}>
        {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryText}>Create {isProfessional ? "Professional" : "customer"} account</Text>}
      </Pressable>
      <Pressable disabled={busy} onPress={() => router.replace({ pathname: "/auth/sign-in", params: isProfessional ? { entry: "professional" } : {} })} style={s.link}><Text style={s.linkText}>Already have an account? Sign in</Text></Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { color: colors.deepGreen, fontWeight: "700", marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  note: { color: colors.muted, marginTop: 8, marginBottom: spacing.lg },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, marginBottom: spacing.sm },
  primary: { minHeight: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  link: { alignItems: "center", padding: spacing.md },
  linkText: { color: colors.deepGreen, fontWeight: "700" },
});
