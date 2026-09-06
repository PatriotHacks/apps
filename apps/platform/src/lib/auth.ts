import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Verified JWT claims, or a redirect to /login. Feeds the RLS transaction. */
export async function requireClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect("/login");
  return data.claims;
}
