import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import { parseActionRequest } from "@/lib/actions";
import { buildAgentRun, filterSkillPool } from "@/lib/agent";
import { rankMemoryChunks } from "@/lib/semantic";
import { isSkillMemory } from "@/lib/skill-activity";
import { createAgentRun, readStore } from "@/lib/store";

const createSchema = z.object({
  goal: z.string().trim().min(5).max(2000),
  projectId: z.string().min(1).optional(),
});

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  const runs = (store.agentRuns || []).slice(0, 30);
  const learningRecords = (store.learningRecords || []).slice(0, 40);
  const rated = runs.filter((run) => run.outcome !== "unrated");
  const successful = rated.filter((run) => run.outcome === "success").length;
  const skillScores = (store.skillScores || [])
    .map((score) => ({
      ...score,
      title:
        store.memories
          .find((memory) => memory.id === score.skillId)
          ?.title.replace(/^(Skill|Reference) · /, "") || "Unknown skill",
    }))
    .sort((left, right) => right.score - left.score || right.uses - left.uses)
    .slice(0, 12);
  return NextResponse.json({
    runs,
    learningRecords,
    skillScores,
    projects: store.projects,
    activeProjectId: store.activeProjectId,
    stats: {
      totalRuns: runs.length,
      completedRuns: runs.filter((run) => run.status === "completed").length,
      learnedLessons: learningRecords.length,
      ratedRuns: rated.length,
      successRate: rated.length ? Math.round((successful / rated.length) * 100) : 0,
      strengthenedSkills: skillScores.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const store = await readStore();
  const projectId = parsed.data.projectId || store.activeProjectId;
  const project = store.projects.find((item) => item.id === projectId);
  const projectMemories = store.memories.filter(
    (memory) => !isSkillMemory(memory) && (!projectId || memory.projectId === projectId),
  );
  const projectSignal = `${project?.name || ""} ${project?.summary || ""} ${project?.goal || ""} ${parsed.data.goal}`;
  const allSkills = store.memories.filter(isSkillMemory);
  const relevantSkillPool = filterSkillPool(projectSignal, allSkills);
  const rankedSkills = rankMemoryChunks(
    parsed.data.goal,
    relevantSkillPool,
    6,
  );
  const rankedContext = rankMemoryChunks(
    parsed.data.goal,
    projectMemories.length ? projectMemories : store.memories.filter((memory) => !isSkillMemory(memory)),
    6,
  );
  const ranked = [...rankedSkills, ...rankedContext]
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
  const run = buildAgentRun({
    goal: parsed.data.goal,
    projectId,
    ranked,
    proposedAction: parseActionRequest(parsed.data.goal),
  });
  await createAgentRun(run);
  return NextResponse.json(run, { status: 201 });
}
