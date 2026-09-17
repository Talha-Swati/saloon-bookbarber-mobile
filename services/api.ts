// Base URL of the BookBarber web backend, for the few things the mobile app cannot do
// straight against Supabase — today that is only the payment initiation route, which
// has to run server-side because it touches merchant credentials and service-role RPCs.
//
// EXPO_PUBLIC_API_URL is public configuration, NOT a secret: it is a plain origin, the
// same class of value as EXPO_PUBLIC_SUPABASE_URL, and it is meant to be in the client
// bundle. No credential is ever read here — the Easypaisa keys live only on the web
// server, and the mobile app never sees them.
//
// No hardcoded production URL: an unset value means the feature is simply unavailable
// and says so, rather than silently pointing at somebody's deployment.

const raw = process.env.EXPO_PUBLIC_API_URL;

/** Origin with any trailing slash removed, or null when unconfigured. */
export function apiBaseUrl(): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

export const isApiConfigured = Boolean(apiBaseUrl());

/** Absolute URL for a backend path, e.g. apiUrl("/api/payments/initiate"). */
export function apiUrl(path: string): string {
  const base = apiBaseUrl();
  if (!base) {
    throw new Error("API_NOT_CONFIGURED");
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
