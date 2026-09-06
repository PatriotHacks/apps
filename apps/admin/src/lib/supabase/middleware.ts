import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Reachable without a session. Everything else needs one, plus an `admins` row. */
const PUBLIC_PREFIXES = ["/login", "/auth"];

const isPublic = (pathname: string) =>
  PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        },
      },
    },
  );

  // Refreshes the access token and writes the rotated cookies through `setAll`.
  const { data } = await supabase.auth.getClaims();

  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) {
    return response;
  }

  if (!data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(url, response);
  }

  // Console access is membership in `admins`, not merely being signed in. Read
  // through PostgREST so the `admins_select_own` policy is what answers.
  const { data: membership } = await supabase
    .from("admins")
    .select("role")
    .eq("user_id", data.claims.sub)
    .maybeSingle();

  if (!membership) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "not_authorized");
    return redirectKeepingCookies(url, response);
  }

  return response;
}

/**
 * A redirect is a fresh response, so the rotated auth cookies written above have
 * to be carried over or the next request refreshes all over again.
 */
export function redirectKeepingCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
