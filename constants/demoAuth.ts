import AsyncStorage from "@react-native-async-storage/async-storage";

export type DemoAuthRole = "customer" | "professional";

// The __DEV__ guard makes the bypass impossible to enable in a production bundle.
export const DEMO_AUTH_BYPASS_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_AUTH_BYPASS === "true";

const ACTIVE_ROLE_KEY = "@bookbarber/demo-auth/active-role";
const roleKey = (role: DemoAuthRole) =>
  `@bookbarber/demo-auth/session/${role}`;

export async function restoreDemoRole(): Promise<DemoAuthRole | null> {
  if (!DEMO_AUTH_BYPASS_ENABLED) return null;

  const role = await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
  if (role !== "customer" && role !== "professional") return null;

  return (await AsyncStorage.getItem(roleKey(role))) === "active" ? role : null;
}

export async function saveDemoRole(role: DemoAuthRole) {
  await AsyncStorage.multiSet([
    [roleKey(role), "active"],
    [ACTIVE_ROLE_KEY, role],
  ]);
}

export async function clearDemoRole(role: DemoAuthRole) {
  await AsyncStorage.multiRemove([roleKey(role), ACTIVE_ROLE_KEY]);
}

export const demoIdentity = (role: DemoAuthRole) => ({
  id: `demo-${role}`,
  email: `demo-${role}@bookbarber.local`,
  user_metadata: {
    full_name: role === "customer" ? "Demo Customer" : "Demo Professional",
    role,
    is_demo_account: true,
  },
});
