import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { applyStudioPlan, rollbackStudioPlan } from "@/lib/studio-bridge";
import {
  deleteStudioBridgePlan,
  readStore,
  recordAction,
  updateStudioBridgePlan,
} from "@/lib/store";

export const runtime = "nodejs";

const commandSchema = z.object({
  command: z.enum(["approve", "execute", "rollback"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = commandSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  const store = await readStore();
  const plan = (store.studioBridgePlans || []).find((item) => item.id === id);
  if (!plan)
    return NextResponse.json({ error: "Studio bridge plan not found." }, { status: 404 });

  if (parsed.data.command === "approve") {
    if (plan.status !== "preview_ready")
      return NextResponse.json({ error: "Only a fresh preview can be approved." }, { status: 409 });
    if (plan.preview.some((item) => !item.safe))
      return NextResponse.json({ error: "Unsafe preview items must be resolved before approval." }, { status: 409 });
    return NextResponse.json(
      await updateStudioBridgePlan(id, {
        status: "approved",
        approvedAt: new Date().toISOString(),
        error: undefined,
      }),
    );
  }

  if (parsed.data.command === "execute") {
    if (plan.status !== "approved")
      return NextResponse.json({ error: "Approve the exact preview before execution." }, { status: 409 });
    await updateStudioBridgePlan(id, { status: "applying", error: undefined });
    try {
      const result = await applyStudioPlan(plan);
      if (!result.verificationOk) {
        const verificationError =
          "Studio changed, but post-write verification did not pass. Rollback is available.";
        const failed = await updateStudioBridgePlan(id, {
          status: "failed",
          rollback: result.rollback,
          verification: result.verification,
          error: verificationError,
          appliedAt: new Date().toISOString(),
        });
        await recordAction({
          id: randomUUID(),
          kind: "studio_bridge",
          title: plan.title,
          status: "failed",
          summary: verificationError,
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ error: verificationError, plan: failed }, { status: 500 });
      }
      const updated = await updateStudioBridgePlan(id, {
        status: "verified",
        rollback: result.rollback,
        verification: result.verification,
        appliedAt: new Date().toISOString(),
      });
      await recordAction({
        id: randomUUID(),
        kind: "studio_bridge",
        title: plan.title,
        status: "completed",
        summary: `Applied and verified ${result.changed} Studio change${result.changed === 1 ? "" : "s"}.`,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Studio execution failed.";
      const failed = await updateStudioBridgePlan(id, { status: "failed", error: message });
      await recordAction({
        id: randomUUID(),
        kind: "studio_bridge",
        title: plan.title,
        status: "failed",
        summary: message,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ error: message, plan: failed }, { status: 500 });
    }
  }

  if (plan.status !== "verified" && !(plan.status === "failed" && plan.rollback.length))
    return NextResponse.json({ error: "Only an applied bridge execution can be rolled back." }, { status: 409 });
  try {
    const result = await rollbackStudioPlan(plan);
    const updated = await updateStudioBridgePlan(id, {
      status: "rolled_back",
      verification: result.verification,
      rolledBackAt: new Date().toISOString(),
    });
    await recordAction({
      id: randomUUID(),
      kind: "studio_bridge",
      title: `Rollback · ${plan.title}`,
      status: "completed",
      summary: `Rolled back ${result.changed} Studio change${result.changed === 1 ? "" : "s"}.`,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio rollback failed.";
    const failed = await updateStudioBridgePlan(id, { error: message });
    return NextResponse.json({ error: message, plan: failed }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const store = await readStore();
  const plan = (store.studioBridgePlans || []).find((item) => item.id === id);
  if (!plan)
    return NextResponse.json({ error: "Studio bridge plan not found." }, { status: 404 });
  if (["approved", "applying", "verified"].includes(plan.status))
    return NextResponse.json(
      { error: "Rollback an applied plan before removing its audit record." },
      { status: 409 },
    );
  await deleteStudioBridgePlan(id);
  return NextResponse.json({ ok: true });
}
