import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function guard() {
  if (await isAuthenticated()) return null;
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

