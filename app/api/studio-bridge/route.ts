import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import {
  createBridgePlan,
  getStudioBridgeOverview,
  previewStudioOperations,
  validateStudioOperations,
} from "@/lib/studio-bridge";
import {
  createStudioBridgePlan,
  readStore,
  updateStudioConnection,
} from "@/lib/store";

export const runtime = "nodejs";

const path = z.string().trim().min(1).max(500);
const name = z.string().trim().min(1).max(60);
const operationSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().trim().min(1).max(100),
    kind: z.literal("create_folder"),
    parentPath: path,
    name,
  }),
  z.object({
    id: z.string().trim().min(1).max(100),
    kind: z.literal("create_script"),
    parentPath: path,
    name,
    className: z.enum(["Script", "LocalScript", "ModuleScript"]),
    source: z.string().min(1).max(24_000),
  }),
  z.object({
    id: z.string().trim().min(1).max(100),
    kind: z.literal("set_attribute"),
    targetPath: path,
    name,
    value: z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  }),
]);

const createSchema = z.object({
  studioId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(1000),
  operations: z.array(operationSchema).min(1).max(20),
});

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const store = await readStore();
    const overview = await getStudioBridgeOverview(store.studioConnection?.studioId);
    if (overview.connected && overview.studio)
      await updateStudioConnection({
        studioId: overview.studio.id,
        name: overview.studio.name,
        mode: overview.studio.mode,
        placeId: overview.studio.placeId,
        universeId: overview.studio.universeId,
        persistedToCloud: Boolean(overview.studio.persistedToCloud),
        projectId: store.studioConnection?.projectId || store.activeProjectId,
        lastSeenAt: new Date().toISOString(),
      });
    return NextResponse.json({
      ...overview,
      plans: (store.studioBridgePlans || []).slice(0, 30),
      activeProjectId: store.activeProjectId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        plans: [],
        error: error instanceof Error ? error.message : "Studio inspection failed.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const store = await readStore();
    validateStudioOperations(parsed.data.operations);
    const overview = await getStudioBridgeOverview(
      parsed.data.studioId || store.studioConnection?.studioId,
    );
    if (!overview.connected || !overview.studio)
      return NextResponse.json({ error: "No Roblox Studio instance is connected." }, { status: 409 });
    if (overview.studio.mode !== "Edit")
      return NextResponse.json({ error: "Studio must be in Edit mode." }, { status: 409 });
    const preview = await previewStudioOperations(
      overview.studio.id,
      parsed.data.operations,
    );
    const plan = createBridgePlan({
      studioId: overview.studio.id,
      studioName: overview.studio.name,
      projectId: parsed.data.projectId || store.activeProjectId,
      title: parsed.data.title,
      description: parsed.data.description,
      operations: parsed.data.operations,
      preview,
    });
    await createStudioBridgePlan(plan);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create a Studio preview." },
      { status: 409 },
    );
  }
}

