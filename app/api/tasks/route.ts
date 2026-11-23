import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { createTask, readStore } from "@/lib/store";

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  projectId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  return NextResponse.json({ tasks: store.tasks, projects: store.projects });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await createTask(parsed.data), { status: 201 });
}

