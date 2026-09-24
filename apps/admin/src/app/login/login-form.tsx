"use client";

import { AuthLayout, AuthNotice, AuthProviderButton } from "@patriothacks/ui";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  auth_failed: "Sign-in failed. Try again.",
  not_authorized: "This account does not have console access.",
};

export function LoginForm({ next, error }: { next: string; error: string | undefined }) {
  const [notice, setNotice] = useState<string | null>(
    error ? (ERRORS[error] ?? "Sign-in failed.") : null,
  );
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setPending(true);
    setNotice(null);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setNotice(oauthError.message);
      setPending(false);
    }
  }

  return (
    <AuthLayout wordmark="PatriotHacks Admin" heading="Sign in to the admin console">
      <AuthProviderButton provider="google" disabled={pending} onClick={signInWithGoogle} />
      {notice ? <AuthNotice>{notice}</AuthNotice> : null}
    </AuthLayout>
  );
}
