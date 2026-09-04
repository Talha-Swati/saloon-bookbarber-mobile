import { Stack } from "expo-router";

export default function ProfessionalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
