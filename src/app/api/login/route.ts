import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** POST /api/login { password } — set the auth cookie on a correct password. */
export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    // Auth is disabled — nothing to sign into.
    return NextResponse.json({ ok: true, authDisabled: true });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== password) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return res;
}

/** DELETE /api/login — log out by clearing the cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
