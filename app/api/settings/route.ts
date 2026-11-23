import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { clearStore } from "@/lib/store";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    postgresConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(process.env.APP_PASSWORD),
    storageMode: process.env.DATABASE_URL ? "PostgreSQL + pgvector" : "Private local JSON store",
  });
}

export async function DELETE(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const { confirmation } = await request.json();
  if (confirmation !== "DELETE EVERYTHING") return NextResponse.json({ error: "Confirmation phrase did not match" }, { status: 400 });
  await clearStore();
  return NextResponse.json({ ok: true });
}
