import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Constants from "expo-constants";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import {
  AppBar,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  enterUp,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchProfessionalProfile,
  professionalErrorMessage,
  ProfessionalProfile,
} from "@/services/professionalService";

export default function ProfessionalProfileScreen() {
  const { role, isDemo, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role !== "professional") {
      router.replace("/professional");
      return;
    }
    fetchProfessionalProfile(isDemo ? "demo" : "remote")
      .then(setProfile)
      .catch((nextError) => setError(professionalErrorMessage(nextError)));
  }, [isDemo, role]);

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You will need to sign in again to see your appointments.", [
      { text: "Stay signed in", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
            router.replace("/professional");
          } catch (e) {
            Alert.alert("Sign out failed", e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (error) {
    return (
      <Screen>
        <AppBar title="My profile" />
        <EmptyState
          actionLabel="Go back"
          body={error}
          onAction={() => router.back()}
          title="Profile did not load"
          tone="error"
        />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <AppBar title="My profile" />
        <View style={s.loading}>
          <Skeleton height={72} style={{ borderRadius: radius.md }} />
          <Skeleton height={96} style={{ borderRadius: radius.md }} />
          <Skeleton height={56} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Screen>
      <AppBar title="My profile" />

      <Animated.View entering={enterUp()} style={s.identity}>
        <View style={s.avatar}>
          <Text style={s.initials}>{initials}</Text>
        </View>
        <Text style={s.name}>{profile.name}</Text>
        <Text style={s.specialty}>{profile.specialty}</Text>
      </Animated.View>

      <Animated.View entering={enterUp(1)}>
        <Card padded={false}>
          <Row label="Salon" value={profile.salonName} />
          <Row label="Specialty" last value={profile.specialty} />
        </Card>
      </Animated.View>

      <SectionHeader
        subtitle="Only bookings for these services are assigned to you."
        title="Services you do"
      />
      {profile.linkedServices.length ? (
        <View style={s.services}>
          {profile.linkedServices.map((service, index) => (
            <Animated.View entering={enterUp(index)} key={service}>
              <Card style={s.service}>
                <Icon color={colors.deepGreen} name="scissors" size={16} />
                <Text style={s.serviceText}>{service}</Text>
              </Card>
            </Animated.View>
          ))}
        </View>
      ) : (
        <EmptyState
          body="Your salon has not linked you to any service yet, so nothing can be assigned to you. Ask your manager to add them on the Team page."
          icon="scissors"
          title="No services linked"
        />
      )}

      {/*
        Everything on this screen is set by the salon on its Team page, not here. Saying
        so is what stops a barber hunting for an edit button that is not coming.
      */}
      <Text style={s.managed}>
        Your salon manages these details from the salon console. Ask them to change
        anything that is wrong.
      </Text>

      <Button
        icon="logout"
        label="Sign out"
        loading={busy}
        onPress={confirmSignOut}
        style={s.signOut}
        variant="destructive"
      />

      <Text style={s.version}>BookBarber {Constants.expoConfig?.version ?? ""}</Text>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && s.lastRow]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md, marginTop: spacing.md },
  identity: { alignItems: "center", paddingVertical: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.onPrimary, fontSize: 24, fontWeight: "800" },
  name: { ...type.title, color: colors.text, marginTop: spacing.md },
  specialty: { ...type.body, color: colors.muted, marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { ...type.caption, color: colors.secondaryText },
  rowValue: { ...type.caption, fontWeight: "700", color: colors.text, flex: 1, textAlign: "right" },
  services: { gap: spacing.sm },
  service: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  serviceText: { ...type.bodyStrong, color: colors.text },
  managed: {
    ...type.label,
    fontWeight: "400",
    color: colors.muted,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
  signOut: { marginTop: spacing.lg },
  version: {
    ...type.label,
    fontWeight: "400",
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
