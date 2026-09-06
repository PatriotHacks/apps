import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Per-request. Never hoist to module scope — the cookie store is request-bound. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. Middleware refreshes the
            // session on every request, so the write is already covered there.
          }
        },
      },
    },
  );
}
