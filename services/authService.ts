import { supabase, requireSupabaseConfig } from "@/services/supabase";
import { User } from "@supabase/supabase-js";

export type RegistrationRole = "customer" | "professional";

/** Every role in the platform's user_role enum — see AppRole in providers/AuthProvider. */
export type AccountRole = "customer" | "professional" | "salon_admin" | "super_admin";

const ACCOUNT_ROLES: readonly AccountRole[] = ["customer", "professional", "salon_admin", "super_admin"];
const asAccountRole = (value: unknown): AccountRole | null =>
  ACCOUNT_ROLES.includes(value as AccountRole) ? (value as AccountRole) : null;

const registrationRole = (value: unknown): RegistrationRole =>
  value === "professional" ? "professional" : "customer";

/**
 * Makes sure a profiles row exists for this user, and reports the role it holds.
 *
 * The role is READ from the existing row, never rewritten: profiles.role is what every
 * RLS policy authorises against (via current_user_role()), and a salon admin who happens
 * to open the mobile app must not have their role quietly downgraded to `customer`
 * because the device passed no role. Only a brand-new row gets a role written, and only
 * one the device is allowed to assert.
 */
async function ensureProfile(
  user: User,
  fullName?: string,
  requestedRole?: RegistrationRole,
): Promise<AccountRole> {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw readError;

  const resolvedName =
    fullName?.trim() || String(user.user_metadata.full_name ?? "").trim();
  const profile = {
    id: user.id,
    full_name: resolvedName,
    email: user.email ?? "",
  };

  if (existing) {
    const { error } = await supabase.from("profiles").update(profile).eq("id", user.id);
    if (error) throw error;
    return asAccountRole(existing.role) ?? "customer";
  }

  const role = requestedRole ?? registrationRole(user.user_metadata.role);
  const { error } = await supabase.from("profiles").insert({ ...profile, role });
  if (error) throw error;
  return role;
}

export async function signIn(email: string, password: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  // The role is returned so the caller can route by what the account ACTUALLY is,
  // rather than by which button the person happened to tap on the way in. A barber who
  // signs in through the customer entry used to land on the customer tabs and see an
  // empty booking list — which reads as "my work is missing", not "wrong door".
  const role = data.user ? await ensureProfile(data.user) : null;
  return { ...data, role };
}
/**
 * How long a signup PIN stays valid, in seconds.
 *
 * This constant only drives the countdown the user sees. The AUTHORITATIVE expiry is a
 * Supabase project setting — Authentication → Emails → "Email OTP Expiration" — and the
 * server is what actually rejects a stale code. Keep the two in step: if the project is
 * left on the default (much longer than this), a code would still be accepted after the
 * countdown reaches zero, and the UI would be lying about it.
 */
export const SIGNUP_CODE_TTL_SECONDS = 120;

export type SignUpOutcome =
  /** Signed in immediately — Supabase has "Confirm email" turned off. */
  | { status: "signed_in" }
  /** Account created, but Supabase requires the address to be verified first. */
  | { status: "confirm_email"; email: string };

export async function signUp(
  fullName: string,
  email: string,
  password: string,
  role: RegistrationRole = "customer",
): Promise<SignUpOutcome> {
  requireSupabaseConfig();
  const trimmedEmail = email.trim();
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { full_name: fullName.trim(), role },
    },
  });
  if (error) throw error;
  if (data.user && data.user.identities?.length === 0)
    throw new Error("An account with this email already exists.");

  // No session means Supabase has "Confirm email" enabled and has emailed a
  // verification link. That is a perfectly ordinary, correctly-configured outcome — not
  // a failure. This used to throw a message aimed at whoever set the project up
  // ("Development signup requires Confirm email to be disabled...") which surfaced to
  // real users inside an "Unable to create account" alert, wrongly implying the signup
  // had failed when the account had in fact been created.
  //
  // The profile row is not written here because there is no authenticated session yet to
  // write it under. ensureProfile() also runs on every signIn, so the profile is created
  // the first time they come back after confirming.
  if (!data.session) {
    return { status: "confirm_email", email: trimmedEmail };
  }

  if (data.user) await ensureProfile(data.user, fullName, role);
  return { status: "signed_in" };
}
/**
 * Verifies the PIN from the signup email and completes registration.
 *
 * Uses Supabase's own one-time-password verification rather than a hand-rolled code
 * table: GoTrue already generates, hashes, rate-limits and expires these codes, and it
 * is the only thing that can mint a session from one. Building a parallel `signup_codes`
 * table would duplicate all of that and still not be able to issue the session.
 *
 * `type: "signup"` is the confirmation flow that `signUp()` above triggers — not
 * "email", which is for magic-link sign-in of an already-registered user.
 *
 * On success there is finally an authenticated session, so this is where the profiles
 * row gets written for the confirm-by-email path.
 */
export async function verifySignupCode(input: {
  email: string;
  code: string;
  fullName?: string;
  role?: RegistrationRole;
}) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.verifyOtp({
    email: input.email.trim(),
    token: input.code.trim(),
    type: "signup",
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error("That code could not be verified. Request a new one.");
  }
  await ensureProfile(data.user, input.fullName, input.role);
  return data;
}

/** Sends a fresh signup PIN, invalidating the previous one. */
export async function resendSignupCode(email: string) {
  requireSupabaseConfig();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
  });
  if (error) throw error;
}

/** Turns GoTrue's verification errors into something a person can act on. */
export function signupCodeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  if (/expired/i.test(message)) return "That code has expired. Tap Resend to get a new one.";
  if (/invalid|not found|incorrect/i.test(message)) return "That code isn't right. Check the digits and try again.";
  if (/rate|too many|seconds/i.test(message)) return "Too many attempts. Wait a moment before requesting another code.";
  if (/already (been )?confirmed|already registered/i.test(message))
    return "This email is already confirmed. Please sign in instead.";
  return message || "We couldn't verify that code. Please try again.";
}
