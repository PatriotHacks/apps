"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@patriothacks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type AuthProvider } from "@/lib/auth-providers";
import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  auth_failed: "That sign-in link is invalid or has expired.",
  not_authorized: "This account does not have console access.",
};

const OAUTH_LABELS = { google: "Continue with Google", github: "Continue with GitHub" } as const;

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
  const [message, setMessage] = useState(error ? (ERRORS[error] ?? "Sign-in failed.") : "");
  const [pending, setPending] = useState(false);

  const hasPassword = providers.includes("password");
  const hasMagicLink = providers.includes("magic_link");
  const oauth = providers.filter((p): p is "google" | "github" => p === "google" || p === "github");
  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setMessage(signInError.message);
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function sendMagicLink() {
    setPending(true);
    setMessage("");
    const { error: otpError } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    setMessage(otpError ? otpError.message : "Check your email for a sign-in link.");
    setPending(false);
  }

  async function signInWithOAuth(provider: "google" | "github") {
    setPending(true);
    setMessage("");
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback() },
    });
    if (oauthError) {
      setMessage(oauthError.message);
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>PatriotHacks Admin</CardTitle>
          <CardDescription>Sign in to the console.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sign-in providers are configured. Set NEXT_PUBLIC_AUTH_PROVIDERS.
            </p>
          ) : null}

          {hasPassword || hasMagicLink ? (
            <form className="flex flex-col gap-3" onSubmit={hasPassword ? signInWithPassword : (e) => e.preventDefault()}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              ) : null}

              {hasPassword ? (
                <Button type="submit" disabled={pending}>
                  Sign in
                </Button>
              ) : null}

              {hasMagicLink ? (
                <Button type="button" variant="outline" disabled={pending || !email} onClick={sendMagicLink}>
                  Email me a sign-in link
                </Button>
              ) : null}
            </form>
          ) : null}

          {oauth.map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => signInWithOAuth(provider)}
            >
              {OAUTH_LABELS[provider]}
            </Button>
          ))}

          {message ? <p className="text-sm text-destructive">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
