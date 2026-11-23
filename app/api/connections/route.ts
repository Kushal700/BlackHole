import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { createConnection, removeConnection } from "@/lib/store";

const connectionSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: z.enum(["related_to", "depends_on", "contradicts", "belongs_to_project"]),
});

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = connectionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await createConnection(parsed.data.sourceId, parsed.data.targetId, parsed.data.type), { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Connection id required" }, { status: 400 });
  await removeConnection(id);
  return NextResponse.json({ ok: true });
}

