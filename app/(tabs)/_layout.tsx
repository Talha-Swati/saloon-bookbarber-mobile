import { Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';
import { colors } from '@/constants/theme';
const icon = (glyph: string) => ({ color, size }: { color: ColorValue; size: number }) => <Text style={{ color, fontSize: size }}>{glyph}</Text>;
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { minHeight: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
    <Tabs.Screen name="salons" options={{ title: 'Salons', tabBarIcon: icon('▦') }} />
    <Tabs.Screen name="bookings" options={{ title: 'My Bookings', tabBarIcon: icon('▣') }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('●') }} />
  </Tabs>;
}


