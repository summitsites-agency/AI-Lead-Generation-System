import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

/**
 * Gates the whole app behind a single shared password (APP_PASSWORD).
 *
 * If APP_PASSWORD is not set, auth is disabled and everything is public — handy
 * for local development. On the hosted site you MUST set APP_PASSWORD.
 *
 * (Next 16 renamed the "middleware" file convention to "proxy".)
 */
export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // The login page and its API must stay reachable while logged out.
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await authToken(password))) {
    return NextResponse.next();
  }

  // Not authenticated: APIs get 401, pages redirect to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
