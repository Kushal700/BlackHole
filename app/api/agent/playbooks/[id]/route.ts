import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { deleteAgentPlaybook } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const removed = await deleteAgentPlaybook(id);
  if (!removed)
    return NextResponse.json({ error: "Playbook not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
