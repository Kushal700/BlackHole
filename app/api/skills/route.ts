import { NextResponse } from "next/server";
import { guard } from "@/lib/http";
import {
  discoverySummary,
  ensureKnowledgeAutoSync,
  getKnowledgeSyncStatus,
  listSkillMemories,
  syncSkills,
} from "@/lib/skills";

export const runtime = "nodejs";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  ensureKnowledgeAutoSync();
  const [skills, discovered] = await Promise.all([
    listSkillMemories(),
    discoverySummary(),
  ]);
  return NextResponse.json({
    skills,
    discovered,
    syncStatus: getKnowledgeSyncStatus(),
  });
}

export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  ensureKnowledgeAutoSync();
  const result = await syncSkills();
  return NextResponse.json({ ...result, syncStatus: getKnowledgeSyncStatus() });
}
