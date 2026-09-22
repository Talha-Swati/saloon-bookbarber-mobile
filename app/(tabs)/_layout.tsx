import { Tabs } from "expo-router";
import { useEffect } from "react";
import { ColorValue, Platform, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Icon, IconName } from "@/components/ui";
import { colors, type } from "@/constants/theme";

/**
 * A tab icon that lifts and fills when it becomes the active tab.
 *
 * Both halves matter. The fill is what makes the active tab readable without relying on
 * the tint alone, and the small lift is the feedback that the tap registered — which the
 * previous text-glyph icons could not give, because a `<Text>` glyph takes no tint and
 * cannot be animated.
 */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: ColorValue }) {
  const lift = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, { damping: 14, mass: 0.5 });
  }, [focused, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 2 }, { scale: 1 + lift.value * 0.08 }],
  }));
  return (
    <Animated.View style={style}>
      <Icon color={color as string} name={name} size={24} />
    </Animated.View>
  );
}

const tab = (active: IconName, idle: IconName) =>
  function TabBarIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <TabIcon color={color} focused={focused} name={focused ? active : idle} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.deepGreen,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: s.bar,
        tabBarLabelStyle: s.label,
        tabBarItemStyle: s.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: tab("home", "homeOutline") }}
      />
      <Tabs.Screen
        name="salons"
        options={{ title: "Salons", tabBarIcon: tab("salons", "salonsOutline") }}
      />
      {/* "Bookings", not "My Bookings": the other three labels are one word, the bar is
          the narrowest row in the app, and nothing else in it could be anyone else's. */}
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarIcon: tab("bookings", "bookingsOutline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: tab("profile", "profileOutline") }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    minHeight: Platform.OS === "ios" ? 84 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: { ...type.label, fontSize: 11, marginTop: 2 },
  item: { paddingVertical: 2 },
});
