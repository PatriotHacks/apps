import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Verified JWT claims, or a redirect to /login. Feeds the RLS transaction. */
export async function requireClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect("/login");
  return data.claims;
}

/**
 * Claims when there is a session, null when there is not. The index uses this
 * because it renders either way: signed out it lists what is open, signed in it
 * says where each application stands.
 */
export async function optionalClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error || !data ? null : data.claims;
}
