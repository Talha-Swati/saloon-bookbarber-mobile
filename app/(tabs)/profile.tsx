import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Constants from "expo-constants";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import {
  Button,
  Card,
  Icon,
  IconName,
  Notice,
  PressableScale,
  Skeleton,
  enterUp,
} from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

/**
 * The account screen.
 *
 * It no longer carries a sign-in form of its own. There were two sign-in surfaces in the
 * app — this one and `/auth/sign-in` — with different rules (six characters here, any
 * password there) and, more seriously, different outcomes: this form called `signIn` and
 * threw away the role it returns, so a barber who signed in from the Profile tab landed
 * in the customer tabs with an empty booking list, and a salon administrator got a
 * customer session instead of being told to use the web console. One sign-in screen,
 * which routes on what the account actually is, is the fix.
 */
export default function Profile() {
  const { session: activeSession, role, loading, configured, demoBypassEnabled, signInDemo, signOut } =
    useAuth();
  const session = role === "customer" ? activeSession : null;
  const [busy, setBusy] = useState(false);

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You will need to sign in again to book or see your bookings.", [
      { text: "Stay signed in", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } catch (e) {
            Alert.alert("Sign out failed", e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <View style={s.loading}>
          <Skeleton height={28} width="45%" />
          <Skeleton height={72} style={{ borderRadius: radius.md }} />
          <Skeleton height={56} style={{ borderRadius: radius.md }} />
          <Skeleton height={56} style={{ borderRadius: radius.md }} />
        </View>
      </Screen>
    );
  }

  const email = session?.user.email ?? "";
  const fullName = session?.user.user_metadata?.full_name;
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : "Customer";

  return (
    <Screen>
      <Animated.View entering={enterUp()}>
        <Text accessibilityRole="header" style={s.title}>
          Profile
        </Text>
      </Animated.View>

      {session ? (
        <>
          <Animated.View entering={enterUp(1)}>
            <Card style={s.identity} tone="raised">
              <View style={s.avatar}>
                <Text style={s.initials}>{(displayName[0] ?? "C").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={s.name}>
                  {displayName}
                </Text>
                <Text numberOfLines={1} style={s.email}>
                  {email}
                </Text>
              </View>
            </Card>
          </Animated.View>

          <SectionHeader title="Account" />
          <Animated.View entering={enterUp(2)} style={s.rows}>
            <Row
              icon="bell"
              label="Notifications"
              onPress={() => router.push("/notifications")}
              value="Booking updates"
            />
            <Row
              icon="bookingsOutline"
              label="My bookings"
              onPress={() => router.navigate("/(tabs)/bookings")}
              value="Upcoming and past"
            />
          </Animated.View>

          <Button
            icon="logout"
            label="Sign out"
            loading={busy}
            onPress={confirmSignOut}
            style={s.signOut}
            variant="destructive"
          />
        </>
      ) : (
        <>
          <Animated.View entering={enterUp(1)} style={s.pitch}>
            <View style={s.pitchMark}>
              <Icon color={colors.deepGreen} name="person" size={26} />
            </View>
            <Text style={s.pitchTitle}>Sign in to book</Text>
            <Text style={s.pitchBody}>
              Browsing salons needs no account. Signing in is what lets you confirm a time,
              see your appointments and cancel one.
            </Text>
          </Animated.View>

          {!configured ? (
            <Notice
              body="Add the Supabase public environment variables and restart Expo."
              title="The app is not connected to a server"
              tone="warning"
            />
          ) : null}

          <Animated.View entering={enterUp(2)} style={s.authActions}>
            <Button
              disabled={!configured && !demoBypassEnabled}
              label="Sign in"
              onPress={() => router.push("/auth/sign-in")}
            />
            <Button
              disabled={!configured}
              label="Create an account"
              onPress={() => router.push("/auth/sign-up")}
              variant="secondary"
            />
          </Animated.View>

          {/*
            Where the launch-screen role gateway went.
            Asking every customer, on every cold start, whether they were a barber cost
            the many to serve the few — and the few only ever answer it once, because the
            session persists. Here it is one row, in the place a person looks when the app
            is not doing what they expected.
          */}
          <SectionHeader title="Work at a salon?" />
          <Animated.View entering={enterUp(3)} style={s.rows}>
            <Row
              icon="briefcase"
              label="Professional sign in"
              onPress={() => router.push({ pathname: "/auth/sign-in", params: { entry: "professional" } })}
              value="Barbers, stylists and beauticians"
            />
          </Animated.View>

          {demoBypassEnabled ? (
            <Button
              label="Enter customer demo"
              onPress={() => {
                signInDemo("customer").catch(() => {});
              }}
              style={s.demo}
              variant="ghost"
            />
          ) : null}
        </>
      )}

      {/* Support asks for this first, and there is nowhere else in the app to read it. */}
      <Text style={s.version}>BookBarber {Constants.expoConfig?.version ?? ""}</Text>
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} style={s.row}>
      <View style={s.rowIcon}>
        <Icon color={colors.deepGreen} name={icon} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
      </View>
      <Icon color={colors.muted} name="forward" size={16} />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  loading: { gap: spacing.md },
  title: { ...type.display, color: colors.text, marginBottom: spacing.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.onPrimary, fontSize: 20, fontWeight: "800" },
  name: { ...type.cardTitle, color: colors.text },
  email: { ...type.caption, color: colors.muted, marginTop: 2 },
  rows: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...type.bodyStrong, color: colors.text },
  rowValue: { ...type.label, fontWeight: "400", color: colors.muted, marginTop: 2 },
  signOut: { marginTop: spacing.xl },
  pitch: { alignItems: "center", paddingVertical: spacing.lg },
  pitchMark: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pitchTitle: { ...type.title, color: colors.text, marginTop: spacing.md },
  pitchBody: {
    ...type.body,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  authActions: { gap: spacing.sm },
  demo: { marginTop: spacing.sm },
  version: {
    ...type.label,
    fontWeight: "400",
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
