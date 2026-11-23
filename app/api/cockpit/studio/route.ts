import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { updateStudioConnection } from "@/lib/store";

const schema = z.object({
  studioId: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(["Edit", "Play"]),
  placeId: z.number().int().positive().optional(),
  universeId: z.number().int().positive().optional(),
  persistedToCloud: z.boolean(),
  projectId: z.string().optional(),
});

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  return NextResponse.json(
    await updateStudioConnection({
      ...parsed.data,
      lastSeenAt: new Date().toISOString(),
    }),
  );
}
