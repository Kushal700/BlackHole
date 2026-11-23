import { NextRequest, NextResponse } from "next/server";
import { authCookie, createSessionToken, passwordMatches } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  if (!passwordMatches(String(password || ""))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookie.name, createSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: authCookie.secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

