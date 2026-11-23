import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/http";
import {
  readStore,
  setActiveProject,
  updateProject,
  withoutEmbedding,
} from "@/lib/store";
import { rankMemoryChunks } from "@/lib/semantic";
import { isSkillMemory, skillActivityStrength } from "@/lib/skill-activity";

const updateSchema = z.object({
  projectId: z.string().min(1),
  currentObjective: z.string().max(1000).optional(),
  repositoryUrl: z.string().url().or(z.literal("")).optional(),
  releaseStage: z
    .enum(["prototype", "vertical_slice", "alpha", "beta", "live"])
    .optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  const activeProject =
    store.projects.find((project) => project.id === store.activeProjectId) ||
    store.projects[0];
  if (!activeProject)
    return NextResponse.json({ projects: [], activeProject: null });
  const tasks = store.tasks.filter(
    (task) => task.projectId === activeProject.id,
  );
  const memories = store.memories.filter(
    (memory) => memory.projectId === activeProject.id && !memory.archived,
  );
  const objective = activeProject.currentObjective || activeProject.goal;
  const signal = `${objective} ${tasks
    .filter((task) => task.status !== "done")
    .map((task) => task.title)
    .join(" ")}`;
  const rankedSkills = rankMemoryChunks(
    signal,
    store.memories.filter(isSkillMemory),
    18,
  );
  const recommendedSkills = [
    ...new Map(
      rankedSkills.map(({ memory, heading, score }) => [
        memory.id,
        {
          ...withoutEmbedding(memory),
          matchedHeading: heading,
          relevance: score,
        },
      ]),
    ).values(),
  ].slice(0, 8);
  const activeSkills = store.memories
    .filter(
      (memory) => isSkillMemory(memory) && skillActivityStrength(memory) > 0,
    )
    .sort((left, right) =>
      (right.lastUsedAt || "").localeCompare(left.lastUsedAt || ""),
    )
    .slice(0, 8)
    .map(withoutEmbedding);
  const recentActions = (store.actions || []).slice(0, 8);
  return NextResponse.json({
    projects: store.projects,
    activeProject,
    tasks,
    memories: memories.slice(0, 20).map(withoutEmbedding),
    recommendedSkills,
    activeSkills,
    recentActions,
    studioConnection: store.studioConnection,
  });
}

export async function PATCH(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const { projectId, ...patch } = parsed.data;
  const active = await setActiveProject(projectId);
  if (!active)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const project = Object.keys(patch).length
    ? await updateProject(projectId, {
        ...patch,
        repositoryUrl: patch.repositoryUrl || undefined,
      })
    : active;
  return NextResponse.json(project);
}
