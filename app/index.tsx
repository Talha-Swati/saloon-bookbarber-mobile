import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { Button, Card, Icon, Notice, enterUp, haptics } from "@/components/ui";
import { colors, radius, spacing, type } from "@/constants/theme";
import { hasSeenWelcome, markWelcomeSeen } from "@/constants/launchChoice";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Where the app opens.
 *
 * Three different people arrive here and each gets a different answer:
 *
 *   - Somebody already signed in. The session knows what they are, so nothing is asked:
 *     a barber lands in their workspace, a customer in the app. This used to ask anyway,
 *     which was a question the app could answer itself.
 *   - Somebody opening the app for the very first time. They are shown the welcome
 *     below, once, because a barber has no way of discovering that this app has a side
 *     for them unless it says so. See constants/launchChoice.ts.
 *   - Everybody else — signed out, but not new. Straight to browsing salons. Nothing
 *     about finding a salon needs an account, and asking for one before showing any
 *     value is the most expensive screen an app can have. Signing in is asked for where
 *     it is genuinely required: confirming a booking.
 *
 * The one case that is not a redirect is a salon or platform administrator, whose account
 * this app has no screens for. They are told so here rather than being dropped into a
 * customer session, where every list would be empty and the Book button would create
 * bookings under an admin account.
 */
export default function Entry() {
  const { loading, role, session } = useAuth();
  const managerAccount = role === "salon_admin" || role === "super_admin";
  // null while we are still asking storage — distinct from false, so the welcome is never
  // flashed at somebody who has already dismissed it.
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    hasSeenWelcome().then((seen) => {
      if (active) setShowWelcome(!seen);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || managerAccount || showWelcome === null) return;
    // A signed-in person has already been through this once on some device; the welcome
    // would be asking a question their session has answered.
    if (session) {
      void markWelcomeSeen();
      router.replace(role === "professional" ? "/professional" : "/(tabs)");
      return;
    }
    if (showWelcome) return;
    router.replace("/(tabs)");
  }, [loading, managerAccount, role, session, showWelcome]);

  if (managerAccount) return <ManagerAccount />;
  if (showWelcome && !loading && !session) return <Welcome />;

  return (
    <Screen>
      <View style={s.splash}>
        <Animated.View entering={enterUp()} style={s.mark}>
          <Icon color={colors.deepGreen} name="scissors" size={34} />
        </Animated.View>
        <Animated.Text entering={enterUp(1)} style={s.wordmark}>
          BookBarber
        </Animated.Text>
      </View>
    </Screen>
  );
}

/**
 * The first-launch screen, shown once per install.
 *
 * Both options are real destinations, not a preference to be stored: tapping one takes
 * you to that half of the product. Nothing is remembered about which was chosen — only
 * that the question has now been asked — because the choice is a signpost, not a claim
 * about the account.
 */
function Welcome() {
  const go = useCallback(async (destination: "/(tabs)" | "professional") => {
    haptics.select();
    await markWelcomeSeen();
    if (destination === "professional") {
      router.replace({ pathname: "/auth/sign-in", params: { entry: "professional" } });
      return;
    }
    router.replace("/(tabs)");
  }, []);

  return (
    <Screen>
      <View style={s.welcome}>
        <Animated.View entering={enterUp()} style={s.mark}>
          <Icon color={colors.deepGreen} name="scissors" size={32} />
        </Animated.View>
        <Animated.Text entering={enterUp(1)} style={s.welcomeTitle}>
          BookBarber
        </Animated.Text>
        <Animated.Text entering={enterUp(2)} style={s.welcomeBody}>
          Salon appointments you can book from your phone. Which are you?
        </Animated.Text>

        <Animated.View entering={enterUp(3)} style={s.options}>
          <Card
            accessibilityLabel="I want to book an appointment"
            onPress={() => void go("/(tabs)")}
            style={s.option}
            tone="raised"
          >
            <View style={s.optionMark}>
              <Icon color={colors.deepGreen} name="calendar" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>I want to book</Text>
              <Text style={s.optionBody}>
                Find a salon near you, pick a time that is free, and pay in the app.
              </Text>
            </View>
            <Icon color={colors.muted} name="forward" size={18} />
          </Card>

          <Card
            accessibilityLabel="I work at a salon"
            onPress={() => void go("professional")}
            style={s.option}
            tone="raised"
          >
            <View style={s.optionMark}>
              <Icon color={colors.deepGreen} name="briefcase" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>I work at a salon</Text>
              <Text style={s.optionBody}>
                Barbers, stylists and beauticians: see the appointments booked with you.
              </Text>
            </View>
            <Icon color={colors.muted} name="forward" size={18} />
          </Card>
        </Animated.View>

        {/* Says out loud that this is not a decision anyone is stuck with. Someone who
            taps the wrong one should not be wondering how to undo it — and this screen
            never appears again, so if it did not say where the other door is, there would
            be nothing left to ask. */}
        <Animated.Text entering={enterUp(4)} style={s.welcomeFootnote}>
          Professional sign-in is also in the Profile tab, and on the sign-in screen.
        </Animated.Text>
      </View>
    </Screen>
  );
}

function ManagerAccount() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <View style={s.splash}>
        <Animated.View entering={enterUp()} style={s.mark}>
          <Icon color={colors.deepGreen} name="shield" size={32} />
        </Animated.View>
        <Animated.Text entering={enterUp(1)} style={s.wordmark}>
          Admin account
        </Animated.Text>
        <View style={s.notice}>
          <Notice
            body="Open the BookBarber admin console in a browser to manage your salon. Sign out here to use a customer or barber account instead."
            title="This app is for customers and barbers"
            tone="info"
          />
        </View>
        <Button
          label="Sign out"
          onPress={() => {
            signOut().catch(() => {});
          }}
          style={s.action}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  wordmark: { ...type.display, color: colors.text },
  notice: { alignSelf: "stretch", marginTop: spacing.lg },
  action: { alignSelf: "stretch", marginTop: spacing.md },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl },
  welcomeTitle: { ...type.display, color: colors.text },
  welcomeBody: {
    ...type.body,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  options: { alignSelf: "stretch", gap: spacing.md, marginTop: spacing.xl },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  optionMark: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { ...type.cardTitle, color: colors.text },
  optionBody: { ...type.label, fontWeight: "400", color: colors.muted, lineHeight: 17, marginTop: 3 },
  welcomeFootnote: {
    ...type.label,
    fontWeight: "400",
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
