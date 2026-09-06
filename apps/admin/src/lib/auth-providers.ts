/**
 * Which sign-in methods the login page offers. Driven entirely by
 * NEXT_PUBLIC_AUTH_PROVIDERS so enabling a provider in the Supabase dashboard
 * and flipping the env value is the whole change.
 */
export const AUTH_PROVIDERS = ["password", "magic_link", "google", "github"] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export function enabledProviders(): AuthProvider[] {
  return (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AuthProvider =>
      (AUTH_PROVIDERS as readonly string[]).includes(value),
    );
}
