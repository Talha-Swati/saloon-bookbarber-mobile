import { isSupabaseConfigured, supabase } from "@/services/supabase";

/**
 * Platform-wide settings the app is allowed to see.
 *
 * WHY THIS EXISTS
 *
 * platform_settings has carried maintenance_mode and maintenance_message since
 * saloon-bookbarber-web/supabase/migrations/017_platform_settings.sql, and the
 * super-admin console has had a toggle for it the whole time. Nothing in this app ever
 * read it. Flipping the platform to maintenance therefore did nothing here at all:
 * customers went on browsing salons and taking appointments while the website told
 * everyone the platform was down. Mirrors the web client's
 * src/lib/platform/maintenance.ts.
 *
 * WHY THE PUBLIC VIEW
 *
 * platform_settings_public (017) is granted to `anon` and `authenticated` and exposes
 * only platform_name, support_email, support_phone, maintenance_mode and
 * maintenance_message. The private columns stay behind the base table's super-admin RLS,
 * so this is readable with the app's own anon key and needs no privileged call.
 */

export type MaintenanceState = {
  enabled: boolean;
  message: string;
};

const DEFAULT_MESSAGE =
  "BookBarber is undergoing scheduled maintenance. Please check back soon.";

/** What every failure path returns. See the fail-open note below. */
const OFF: MaintenanceState = { enabled: false, message: DEFAULT_MESSAGE };

export async function fetchMaintenanceState(): Promise<MaintenanceState> {
  // requireSupabaseConfig() is deliberately NOT used. An unconfigured build should show
  // its own "Supabase is not configured" errors on the screens that need data, not a
  // maintenance notice that blames the platform for a local env problem.
  if (!isSupabaseConfigured) return OFF;

  try {
    const { data, error } = await supabase
      .from("platform_settings_public")
      .select("maintenance_mode,maintenance_message")
      .maybeSingle();

    // FAIL OPEN. A phone with no signal, or a Supabase blip, must not put the app behind
    // a "we are down" wall — the customer would have no way to tell the difference and
    // no reason to try again. A false negative costs one customer one confusing booking
    // attempt; a false positive locks every customer out of an app that works.
    if (error || !data) return OFF;

    return {
      enabled: data.maintenance_mode === true,
      message: data.maintenance_message?.trim() || DEFAULT_MESSAGE,
    };
  } catch {
    return OFF;
  }
}
