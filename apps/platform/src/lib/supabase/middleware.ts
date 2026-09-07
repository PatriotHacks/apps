import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Reachable without a session. Everything else needs one. */
const PUBLIC_PREFIXES = ["/login", "/auth"];

/**
 * The index lists what is open so someone can see whether it is worth making an
 * account. Only this exact path — `/[slug]` still needs a session, and the
 * `forms_select_anon` policy grants `anon` nothing beyond the form rows
 * themselves, so a signed-out visitor can read the list and no more.
 */
const PUBLIC_PATHS = ["/"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) ||
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
  if (!data?.claims && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
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
