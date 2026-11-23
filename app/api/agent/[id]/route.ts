import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import {
  buildGroundedAgentResult,
  buildLearningRecord,
} from "@/lib/agent";
import { executeActionProposal } from "@/lib/action-executor";
import {
  completeAgentRun,
  deleteAgentRun,
  markSkillMemoriesUsed,
  readStore,
  recordAction,
  recordAgentFeedback,
  updateAgentRun,
} from "@/lib/store";

const commandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("approve") }),
  z.object({ command: z.literal("reject") }),
  z.object({
    command: z.literal("feedback"),
    outcome: z.enum(["success", "partial", "failed"]),
    feedback: z.string().trim().max(2000).optional(),
  }),
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = commandSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const { id } = await context.params;
  const store = await readStore();
  const run = (store.agentRuns || []).find((item) => item.id === id);
  if (!run)
    return NextResponse.json({ error: "Agent run not found." }, { status: 404 });

  if (parsed.data.command === "feedback") {
    if (run.status !== "completed")
      return NextResponse.json(
        { error: "Only completed runs can receive outcome feedback." },
        { status: 409 },
      );
    const updated = await recordAgentFeedback(
      id,
      parsed.data.outcome,
      parsed.data.feedback,
    );
    return NextResponse.json(updated);
  }

  if (run.status !== "awaiting_approval")
    return NextResponse.json(
      { error: "This run is no longer waiting for approval." },
      { status: 409 },
    );

  if (parsed.data.command === "reject") {
    const rejected = await updateAgentRun(id, {
      status: "rejected",
      steps: run.steps.map((step) =>
        step.status === "pending" ? { ...step, status: "skipped" } : step,
      ),
      result: "Plan rejected. No action was taken and no lesson was scored.",
    });
    return NextResponse.json(rejected);
  }

  await updateAgentRun(id, {
    status: "executing",
    steps: run.steps.map((step) =>
      step.kind === "skills" || step.kind === "act"
        ? { ...step, status: "active" }
        : step,
    ),
  });
  try {
    await markSkillMemoriesUsed(run.skillIds);
    let actionSummary: string | undefined;
    if (run.proposedAction) {
      const executed = await executeActionProposal(run.proposedAction);
      actionSummary = executed.summary;
      await recordAction({
        id: randomUUID(),
        kind: run.proposedAction.kind,
        title: run.proposedAction.title,
        status: "completed",
        summary: executed.summary,
        createdAt: new Date().toISOString(),
      });
    }
    const result = buildGroundedAgentResult(run, actionSummary);
    const verification = run.evidence.length
      ? `Verified against ${run.evidence.length} local evidence sources. Awaiting your outcome rating.`
      : "No local evidence was available; treat this result as unverified.";
    const finished = {
      ...run,
      result,
      verification,
      status: "completed" as const,
      steps: run.steps.map((step) => ({
        ...step,
        status:
          step.kind === "verify" && !run.evidence.length
            ? ("failed" as const)
            : ("completed" as const),
      })),
    };
    const learning = buildLearningRecord(finished);
    const completed = await completeAgentRun(id, finished, learning);
    return NextResponse.json({ run: completed, learning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed.";
    const failed = await updateAgentRun(id, {
      status: "failed",
      result: message,
      steps: run.steps.map((step) =>
        step.kind === "act" ? { ...step, status: "failed" } : step,
      ),
    });
    if (run.proposedAction)
      await recordAction({
        id: randomUUID(),
        kind: run.proposedAction.kind,
        title: run.proposedAction.title,
        status: "failed",
        summary: message,
        createdAt: new Date().toISOString(),
      });
    return NextResponse.json({ error: message, run: failed }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await context.params;
  const removed = await deleteAgentRun(id);
  if (!removed)
    return NextResponse.json({ error: "Agent run not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
