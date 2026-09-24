import { safeNext } from "@/lib/paths";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return <LoginForm next={safeNext(next)} error={error} />;
}
