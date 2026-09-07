"use client";

import {
  AuthActionButton,
  AuthDisclosure,
  AuthLayout,
  AuthNotice,
  AuthProviderButton,
  Input,
  Label,
} from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type AuthProvider } from "@/lib/auth-providers";
import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  auth_failed: "That sign-in link is invalid or has expired.",
  not_authorized: "This account does not have console access.",
};

type Notice = { tone: "error" | "success"; text: string } | null;

export function LoginForm({
  providers,
  next,
  error,
}: {
  providers: AuthProvider[];
  next: string;
  error: string | undefined;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(
    error ? { tone: "error", text: ERRORS[error] ?? "Sign-in failed." } : null,
  );
  const [pending, setPending] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const hasPassword = providers.includes("password");
  const hasMagicLink = providers.includes("magic_link");
  const oauth = providers.filter((p): p is "google" | "github" => p === "google" || p === "github");
  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // The disclosure only earns its place when it is hiding a *secondary* option.
  // With no OAuth configured the email form is the only way in, so it is shown.
  const hasEmail = hasPassword || hasMagicLink;
  const emailIsOnlyOption = oauth.length === 0;
  const emailVisible = hasEmail && (emailIsOnlyOption || emailOpen);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setNotice({ tone: "error", text: signInError.message });
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function sendMagicLink() {
    setPending(true);
    setNotice(null);
    const { error: otpError } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    setNotice(
      otpError
        ? { tone: "error", text: otpError.message }
        : { tone: "success", text: "Check your email for a sign-in link." },
    );
    setPending(false);
  }

  async function signInWithOAuth(provider: "google" | "github") {
    setPending(true);
    setNotice(null);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback() },
    });
    if (oauthError) {
      setNotice({ tone: "error", text: oauthError.message });
      setPending(false);
    }
  }

  return (
    <AuthLayout wordmark="PatriotHacks Admin" heading="Sign in to the admin console">
      {providers.length === 0 ? (
        <AuthNotice>
          No sign-in providers are configured. Set NEXT_PUBLIC_AUTH_PROVIDERS.
        </AuthNotice>
      ) : null}

      {oauth.map((provider, index) => (
        <AuthProviderButton
          key={provider}
          provider={provider}
          emphasis={index === 0 ? "solid" : "outline"}
          disabled={pending}
          onClick={() => signInWithOAuth(provider)}
        />
      ))}

      {hasEmail && !emailIsOnlyOption ? (
        <AuthDisclosure
          open={emailOpen}
          onOpenChange={setEmailOpen}
          label="use email"
          controls="email-sign-in"
        />
      ) : null}

      {hasEmail ? (
        <div id="email-sign-in" hidden={!emailVisible}>
          <form
            className="flex flex-col gap-4"
            onSubmit={hasPassword ? signInWithPassword : (e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {hasPassword ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}

            {hasPassword ? (
              <AuthActionButton
                type="submit"
                emphasis={emailIsOnlyOption ? "solid" : "outline"}
                disabled={pending}
              >
                Sign in
              </AuthActionButton>
            ) : null}

            {hasMagicLink ? (
              <AuthActionButton
                type="button"
                emphasis={emailIsOnlyOption && !hasPassword ? "solid" : "outline"}
                disabled={pending || !email}
                onClick={sendMagicLink}
              >
                Email me a sign-in link
              </AuthActionButton>
            ) : null}
          </form>
        </div>
      ) : null}

      {notice ? <AuthNotice tone={notice.tone}>{notice.text}</AuthNotice> : null}
    </AuthLayout>
  );
}
