import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { AuthProvider } from "@/providers/AuthProvider";
import { colors } from "@/constants/theme";
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
          <Stack
            screenOptions={{
              headerShown: false,
              // Screens slide in from the right and the one behind them stays put, which
              // is what makes the back gesture feel like it is uncovering the previous
              // screen rather than loading it again. The default fade gave no sense of
              // depth, so a person could not tell a pushed screen from a replaced one.
              animation: "slide_from_right",
              animationDuration: 260,
              gestureEnabled: true,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ animation: "fade" }} />
            <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
            <Stack.Screen name="auth" />
            <Stack.Screen name="professional" />
            {/* The end of the booking flow, and the one screen that should not look
                like another push — it is an outcome, not a next step. */}
            <Stack.Screen name="booking-confirmation" options={{ animation: "fade_from_bottom" }} />
          </Stack>
        </MaintenanceGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
