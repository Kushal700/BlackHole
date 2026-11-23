import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { deleteMemory, getMemory, updateMemory } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: Context) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const memory = await getMemory(id);
  return memory ? NextResponse.json(memory) : NextResponse.json({ error: "Memory not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, context: Context) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const memory = await updateMemory(id, await request.json());
  return memory ? NextResponse.json(memory) : NextResponse.json({ error: "Memory not found" }, { status: 404 });
}

export async function DELETE(_: NextRequest, context: Context) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  return (await deleteMemory(id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Memory not found" }, { status: 404 });
}
