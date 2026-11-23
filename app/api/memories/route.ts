import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { createMemory, listMemories, readStore, withoutEmbedding } from "@/lib/store";
import { MEMORY_CATEGORIES } from "@/lib/types";

const schema = z.object({
  title: z.string().min(1).max(180),
  content: z.string().min(1).max(100000),
  category: z.enum(MEMORY_CATEGORIES),
  tags: z.array(z.string().max(40)).max(24).default([]),
  source: z.string().max(180).default("Manual entry"),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  projectId: z.string().optional(),
  archived: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const query = request.nextUrl.searchParams.get("q") || "";
  const includeArchived = request.nextUrl.searchParams.get("archived") === "true";
  const store = await readStore();
  return NextResponse.json({
    memories: (await listMemories(query, includeArchived)).map(withoutEmbedding),
    connections: store.connections,
    projects: store.projects,
  });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await createMemory(parsed.data), { status: 201 });
}
