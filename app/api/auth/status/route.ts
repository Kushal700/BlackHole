import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ authenticated: await isAuthenticated(), configured: Boolean(process.env.APP_PASSWORD) });
}

