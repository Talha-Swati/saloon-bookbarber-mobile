import { Session } from "@supabase/supabase-js";
import {
  PropsWithChildren,
  createContext,
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
type AuthValue = {
  session: AppSession | null;
  role: DemoAuthRole | null;
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
export function AuthProvider({ children }: PropsWithChildren) {
  const [realSession, setRealSession] = useState<Session | null>(null);
  const [demoRole, setDemoRole] = useState<DemoAuthRole | null>(null);
  const [loading, setLoading] = useState(true);
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
      if (mounted) {
        setRealSession(data.session);
        setLoading(false);
      }
    };
    initialize();
    if (!isSupabaseConfigured) return () => { mounted = false; };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setRealSession(next);
      setLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
  const role = demoRole ??
    (realSession
      ? realSession.user.user_metadata.role === "professional"
        ? "professional"
        : "customer"
      : null);
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
