import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { createProject, readStore, withoutEmbedding } from "@/lib/store";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  return NextResponse.json({ projects: store.projects, memories: store.memories.map(withoutEmbedding), tasks: store.tasks });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = z.object({ name: z.string().min(1), summary: z.string().min(1), goal: z.string().min(1) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await createProject(parsed.data), { status: 201 });
}
