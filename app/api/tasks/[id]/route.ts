import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { updateTask } from "@/lib/store";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const task = await updateTask(id, await request.json());
  return task ? NextResponse.json(task) : NextResponse.json({ error: "Task not found" }, { status: 404 });
}
