import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import {
  createBackup,
  listBackups,
  previewBackup,
  restoreBackup,
} from "@/lib/store";

export const runtime = "nodejs";

const fileSchema = z.object({ filename: z.string().min(1).max(240) });
const restoreSchema = fileSchema.extend({
  confirmation: z.literal("RESTORE BACKUP"),
});

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const filename = new URL(request.url).searchParams.get("filename");
  if (filename) return NextResponse.json(await previewBackup(filename));
  return NextResponse.json({ backups: await listBackups() });
}

export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ backup: await createBackup() }, { status: 201 });
}

export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = restoreSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Type RESTORE BACKUP to confirm." },
      { status: 400 },
    );
  return NextResponse.json(await restoreBackup(parsed.data.filename));
}
