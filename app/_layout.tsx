import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { AuthProvider } from "@/providers/AuthProvider";
export { ErrorBoundary } from "expo-router";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        {/*
          Inside AuthProvider so the session is still established underneath — a customer
          who opens the app during maintenance and closes it again stays signed in. The
          gate reads platform_settings_public, which anon and authenticated may both
          read, so it works either way.
        */}
        <MaintenanceGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="professional" />
          </Stack>
        </MaintenanceGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
