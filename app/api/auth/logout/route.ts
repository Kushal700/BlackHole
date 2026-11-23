import { NextResponse } from "next/server";
import { authCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookie.name, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}

