import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { guard } from "@/lib/http";
import {
  readStore,
  recordAction,
} from "@/lib/store";
import type { ActionRecord } from "@/lib/types";
import { executeActionProposal } from "@/lib/action-executor";

const proposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create_task"),
    title: z.string(),
    description: z.string(),
    risk: z.enum(["low", "medium"]),
    payload: z.object({
      title: z.string().min(1).max(180),
      description: z.string().max(2000).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      projectName: z.string().optional(),
    }),
  }),
  z.object({
    kind: z.literal("create_memory"),
    title: z.string(),
    description: z.string(),
    risk: z.enum(["low", "medium"]),
    payload: z.object({
      title: z.string().min(1).max(180),
      content: z.string().min(1).max(100000),
    }),
  }),
  z.object({
    kind: z.literal("update_project_progress"),
    title: z.string(),
    description: z.string(),
    risk: z.enum(["low", "medium"]),
    payload: z.object({
      projectName: z.string().min(1),
      progress: z.number().int().min(0).max(100),
    }),
  }),
  z.object({
    kind: z.literal("sync_library"),
    title: z.string(),
    description: z.string(),
    risk: z.enum(["low", "medium"]),
    payload: z.object({}),
  }),
]);

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  return NextResponse.json({ actions: (store.actions || []).slice(0, 50) });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = proposalSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const proposal = parsed.data;
  try {
    const { summary, result } = await executeActionProposal(proposal);
    const record: ActionRecord = {
      id: randomUUID(),
      kind: proposal.kind,
      title: proposal.title,
      status: "completed",
      summary,
      createdAt: new Date().toISOString(),
    };
    await recordAction(record);
    return NextResponse.json({ ok: true, summary, result, record });
  } catch (error) {
    const summary =
      error instanceof Error ? error.message : "The action failed.";
    await recordAction({
      id: randomUUID(),
      kind: proposal.kind,
      title: proposal.title,
      status: "failed",
      summary,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ error: summary }, { status: 500 });
  }
}
