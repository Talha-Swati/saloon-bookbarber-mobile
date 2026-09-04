import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, radius, spacing } from "@/constants/theme";
import { signIn } from "@/services/authService";
import { useAuth } from "@/providers/AuthProvider";

export default function SignIn() {
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const professionalEntry = entry === "professional";
  const { demoBypassEnabled, signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!demoBypassEnabled && (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password)) {
      Alert.alert("Check your details", "Enter a valid email and password.");
      return;
    }
    setBusy(true);
    try {
      if (demoBypassEnabled)
        await signInDemo(professionalEntry ? "professional" : "customer");
      else await signIn(email, password);
      router.replace(
        professionalEntry ? "/professional" : "/(tabs)",
      );
    } catch (error) {
      Alert.alert("Unable to sign in", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
      <Text style={s.title}>Welcome back</Text>
      <Text style={s.note}>
        Sign in to your {professionalEntry ? "Professional" : "BookBarber"} account.
      </Text>
      <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={s.input} />
      <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} style={s.input} />
      <Pressable disabled={busy} onPress={submit} style={[s.primary, busy && s.disabled]}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryText}>Sign in</Text>}
      </Pressable>
      <Pressable disabled={busy} onPress={() => router.replace({ pathname: "/auth/sign-up", params: professionalEntry ? { role: "professional" } : {} })} style={s.link}><Text style={s.linkText}>Create a {professionalEntry ? "Professional" : "customer"} account</Text></Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { color: colors.dark, fontWeight: "700", marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  note: { color: colors.muted, marginTop: 8, marginBottom: spacing.lg },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, marginBottom: spacing.sm },
  primary: { minHeight: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryText: { color: "#FFF", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  link: { alignItems: "center", padding: spacing.md },
  linkText: { color: colors.dark, fontWeight: "700" },
});
