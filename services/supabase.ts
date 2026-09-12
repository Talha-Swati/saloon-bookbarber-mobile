import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
export const supabase = createClient(
  url ?? "https://missing-project.supabase.co",
  anonKey ?? "missing-anon-key",
  {
    auth: {
      // AsyncStorage's web implementation calls `window.localStorage` with no guard,
      // which throws during `expo export --platform web`'s Node-side static
      // prerendering (no `window` there). On web, pass no storage adapter — supabase-js
      // falls back to its own storage helper, which already detects a missing
      // `window`/`localStorage` and swaps in an in-memory no-op instead of persisting,
      // matching Supabase's recommended Expo pattern:
      // https://supabase.com/docs/guides/auth/quickstarts/react-native
      storage: Platform.OS === "web" ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
export function requireSupabaseConfig() {
  if (!isSupabaseConfigured)
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
}
