import { NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { discoverySummary, listSkillMemories, syncSkills } from "@/lib/skills";

export const runtime = "nodejs";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const [skills, discovered] = await Promise.all([listSkillMemories(), discoverySummary()]);
  return NextResponse.json({ skills, discovered });
}

export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json(await syncSkills());
}
