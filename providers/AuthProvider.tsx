import { Session } from "@supabase/supabase-js";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "@/services/supabase";
import {
  clearDemoRole,
  DEMO_AUTH_BYPASS_ENABLED,
  demoIdentity,
  DemoAuthRole,
  restoreDemoRole,
  saveDemoRole,
} from "@/constants/demoAuth";

type DemoSession = {
  kind: "demo";
  role: DemoAuthRole;
  user: ReturnType<typeof demoIdentity>;
};
type AppSession = Session | DemoSession;

/**
 * Every role in the platform's user_role enum, not just the two the app has screens for.
 *
 * A salon admin or super admin CAN sign into this app — nothing stops them — and when
 * they do, the honest answer is "salon_admin", not "customer". Collapsing them into
 * customer would quietly show them a customer's empty booking list and a Book button
 * that creates bookings under their admin account.
 */
export type AppRole = "customer" | "professional" | "salon_admin" | "super_admin";

const APP_ROLES: readonly AppRole[] = ["customer", "professional", "salon_admin", "super_admin"];
const asAppRole = (value: unknown): AppRole | null =>
  APP_ROLES.includes(value as AppRole) ? (value as AppRole) : null;

type AuthValue = {
  session: AppSession | null;
  role: AppRole | null;
  isDemo: boolean;
  demoBypassEnabled: boolean;
  signInDemo: (role: DemoAuthRole) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  configured: boolean;
};
const AuthContext = createContext<AuthValue>({
  session: null,
  role: null,
  isDemo: false,
  demoBypassEnabled: DEMO_AUTH_BYPASS_ENABLED,
  signInDemo: async () => {},
  signOut: async () => {},
  loading: true,
  configured: isSupabaseConfigured,
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves the signed-in user's role from `profiles`, which is the authoritative source.
 *
 * WHY NOT user_metadata.role, which is what this used to read:
 *
 *   1. It is writable by the client. `supabase.auth.signUp({ options: { data: { role }}})`
 *      puts whatever the device sends straight into user_metadata, so it is a claim, not
 *      a fact. Every RLS policy in the schema goes through current_user_role(), which
 *      reads profiles.role — so the app was routing on one value while the database
 *      authorised on another.
 *   2. It is simply absent on any account not created through this app's own signup —
 *      a barber seeded by SQL, or created by a salon admin. The old code defaulted a
 *      missing value to "customer", so a real barber signed in, was treated as a
 *      customer, landed on the customer tabs, and saw no assigned work. That looked
 *      exactly like "the barber has no bookings" and is indistinguishable from the
 *      unassigned-booking bug it was sitting next to.
 */
async function fetchProfileRole(userId: string, metadataRole: unknown): Promise<AppRole> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data?.role) {
      const role = asAppRole(data.role);
      if (role) return role;
    }
    // authService.ensureProfile() writes the profiles row right after sign-in, and
    // onAuthStateChange can fire before that insert lands. One short retry covers the
    // race without making every sign-in wait.
    if (attempt === 0) await sleep(400);
  }

  // No profiles row at all. Fall back to the metadata claim rather than locking the
  // person out, but clamp it to the two roles a device is ever allowed to assert —
  // an admin role must come from the database or not at all.
  const claimed = asAppRole(metadataRole);
  return claimed === "professional" ? "professional" : "customer";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [realSession, setRealSession] = useState<Session | null>(null);
  const [profileRole, setProfileRole] = useState<AppRole | null>(null);
  const [demoRole, setDemoRole] = useState<DemoAuthRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Kept out of the effect below so both the initial load and every later auth event
  // resolve the role the same way.
  const applySession = useCallback(async (next: Session | null) => {
    setRealSession(next);
    if (!next?.user) {
      setProfileRole(null);
      return;
    }
    setProfileRole(await fetchProfileRole(next.user.id, next.user.user_metadata?.role));
  }, []);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      const restoredRole = await restoreDemoRole();
      if (mounted) setDemoRole(restoredRole);
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      // Awaited before clearing `loading`: a screen that renders while the role is
      // still null decides the person is signed out and shows a sign-in prompt to
      // someone who is already signed in.
      await applySession(data.session);
      if (mounted) setLoading(false);
    };
    initialize();
    if (!isSupabaseConfigured) return () => { mounted = false; };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setLoading(true);
      applySession(next).finally(() => {
        if (mounted) setLoading(false);
      });
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signInDemo = async (role: DemoAuthRole) => {
    if (!DEMO_AUTH_BYPASS_ENABLED)
      throw new Error("Demo authentication is disabled.");
    await saveDemoRole(role);
    setDemoRole(role);
  };
  const signOut = async () => {
    if (demoRole) {
      await clearDemoRole(demoRole);
      setDemoRole(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const demoSession: DemoSession | null = demoRole
    ? { kind: "demo", role: demoRole, user: demoIdentity(demoRole) }
    : null;
  const session = demoSession ?? realSession;
  const role: AppRole | null = demoRole ?? (realSession ? profileRole : null);

  const value = useMemo(
    () => ({
      session,
      role,
      isDemo: Boolean(demoSession),
      demoBypassEnabled: DEMO_AUTH_BYPASS_ENABLED,
      signInDemo,
      signOut,
      loading,
      configured: isSupabaseConfigured,
    }),
    [session, role, demoSession, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
