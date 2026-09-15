import { supabase, requireSupabaseConfig } from "@/services/supabase";
import { User } from "@supabase/supabase-js";

export type RegistrationRole = "customer" | "professional";

const registrationRole = (value: unknown): RegistrationRole =>
  value === "professional" ? "professional" : "customer";

async function ensureProfile(
  user: User,
  fullName?: string,
  requestedRole?: RegistrationRole,
) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
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
  const role = requestedRole ?? registrationRole(user.user_metadata.role);
  const result = existing
    ? await supabase.from("profiles").update(profile).eq("id", user.id)
    : await supabase.from("profiles").insert({ ...profile, role });
  if (result.error) throw result.error;
}

export async function signIn(email: string, password: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (data.user) await ensureProfile(data.user);
  return data;
}
export async function signUp(
  fullName: string,
  email: string,
  password: string,
  role: RegistrationRole = "customer",
) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim(), role },
    },
  });
  if (error) throw error;
  if (data.user && data.user.identities?.length === 0)
    throw new Error("An account with this email already exists.");
  // Development expects Authentication > Providers > Email > Confirm email OFF.
  // Keep this branch so verification can be restored later without changing Auth.
  if (!data.session)
    throw new Error(
      "Development signup requires Confirm email to be disabled in Supabase Authentication settings.",
    );
  if (data.user) await ensureProfile(data.user, fullName, role);
  return data;
}