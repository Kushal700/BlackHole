import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { updateProject } from "@/lib/store";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const project = await updateProject(id, await request.json());
  return project ? NextResponse.json(project) : NextResponse.json({ error: "Project not found" }, { status: 404 });
}
