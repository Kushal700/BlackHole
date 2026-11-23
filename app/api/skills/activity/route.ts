import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import {
  markSkillMemoriesUsed,
  readStore,
  withoutEmbedding,
} from "@/lib/store";
import { isSkillMemory, skillActivityStrength } from "@/lib/skill-activity";

const schema = z.object({
  memoryIds: z.array(z.string().min(1)).min(1).max(24),
});

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  const active = store.memories
    .filter(
      (memory) => isSkillMemory(memory) && skillActivityStrength(memory) > 0,
    )
    .sort((left, right) =>
      (right.lastUsedAt || "").localeCompare(left.lastUsedAt || ""),
    );
  return NextResponse.json({ active: active.map(withoutEmbedding) });
}

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const updated = await markSkillMemoriesUsed(parsed.data.memoryIds);
  return NextResponse.json({
    updated: updated.map(withoutEmbedding),
    usedAt: new Date().toISOString(),
  });
}
