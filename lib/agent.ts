import { randomUUID } from "node:crypto";
import {
  cosineSimilarity,
  localEmbedding,
  type RankedMemoryChunk,
} from "@/lib/semantic";
import { isSkillMemory } from "@/lib/skill-activity";
import type {
  ActionProposal,
  AgentEvidence,
  AgentAppliedLesson,
  AgentOutcome,
  AgentRun,
  LearningRecord,
  Memory,
  SkillScore,
} from "@/lib/types";

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function filterSkillPool(signal: string, skills: Memory[]) {
  if (!/\broblox\b/i.test(signal)) return skills;
  return skills.filter(
    (memory) =>
      /\broblox\b/i.test(memory.title) ||
      /roblox-/i.test(memory.source) ||
      memory.tags.includes("roblox"),
  );
}

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((word) => !["the", "and", "for", "with", "that"].includes(word)) || [],
  );
}

export function rankLearningRecords(
  goal: string,
  records: LearningRecord[],
  projectId?: string,
  limit = 3,
): AgentAppliedLesson[] {
  const queryWords = words(goal);
  const queryVector = localEmbedding(goal);
  return records
    .filter((record) => !projectId || record.projectId === projectId)
    .map((record) => {
      const text = `${record.title} ${record.lesson} ${record.feedback || ""}`;
      const recordWords = words(text);
      const hits = [...queryWords].filter((word) => recordWords.has(word)).length;
      const lexical = queryWords.size ? hits / queryWords.size : 0;
      const semantic = cosineSimilarity(queryVector, localEmbedding(text));
      const outcomeWeight =
        record.outcome === "success"
          ? 0.08
          : record.outcome === "failed"
            ? 0.04
            : record.outcome === "partial"
              ? 0.05
              : 0;
      return {
        id: record.id,
        title: record.title,
        lesson: record.feedback
          ? `${record.lesson} Correction: ${record.feedback}`
          : record.lesson,
        outcome: record.outcome,
        confidence: record.confidence,
        relevance: Number(
          (semantic * 0.55 + lexical * 0.3 + record.confidence * 0.15 + outcomeWeight).toFixed(3),
        ),
      };
    })
    .filter((record) => record.relevance >= 0.18)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);
}

export function rerankSkillsWithExperience(
  ranked: RankedMemoryChunk[],
  scores: SkillScore[],
) {
  const byId = new Map(scores.map((score) => [score.skillId, score]));
  return ranked
    .map((item) => {
      const experience = byId.get(item.memory.id);
      if (!experience) return item;
      const evidenceWeight = Math.min(1, experience.uses / 5);
      const multiplier = 1 + (experience.score - 0.5) * 0.35 * evidenceWeight;
      return { ...item, score: item.score * multiplier };
    })
    .sort((left, right) => right.score - left.score);
}

export function buildAgentRun({
  goal,
  projectId,
  ranked,
  proposedAction,
  lessons = [],
  id = randomUUID(),
  timestamp = new Date().toISOString(),
}: {
  goal: string;
  projectId?: string;
  ranked: RankedMemoryChunk[];
  proposedAction?: ActionProposal;
  lessons?: AgentAppliedLesson[];
  id?: string;
  timestamp?: string;
}): AgentRun {
  const evidence: AgentEvidence[] = ranked.slice(0, 6).map((item) => ({
    memoryId: item.memory.id,
    title: item.memory.title,
    heading: item.heading,
    excerpt: item.content.slice(0, 260),
    score: Number(item.score.toFixed(3)),
  }));
  const skillIds = unique(
    ranked
      .filter(({ memory }) => isSkillMemory(memory))
      .map(({ memory }) => memory.id),
  ).slice(0, 6);
  const actionDescription = proposedAction
    ? proposedAction.description
    : "Produce a grounded response from the selected project knowledge. No external systems will be changed.";
  return {
    id,
    goal,
    projectId,
    status: "awaiting_approval",
    skillIds,
    evidence,
    appliedLessons: lessons,
    proposedAction,
    outcome: "unrated",
    steps: [
      {
        id: `${id}-understand`,
        kind: "understand",
        title: "Understand the objective",
        description: "Attach the request to the active project and identify intent.",
        status: "completed",
      },
      {
        id: `${id}-recall`,
        kind: "recall",
        title: "Recall verified context",
        description: `${evidence.length} relevant knowledge source${evidence.length === 1 ? "" : "s"} and ${lessons.length} prior lesson${lessons.length === 1 ? "" : "s"} found.`,
        status: "completed",
      },
      {
        id: `${id}-skills`,
        kind: "skills",
        title: "Activate the skill stack",
        description: `${skillIds.length} matching skill${skillIds.length === 1 ? "" : "s"} will guide the run.`,
        status: "pending",
      },
      {
        id: `${id}-act`,
        kind: "act",
        title: proposedAction ? proposedAction.title : "Synthesize the next move",
        description: actionDescription,
        status: "pending",
        requiresApproval: true,
      },
      {
        id: `${id}-verify`,
        kind: "verify",
        title: "Verify the result",
        description: "Check the completed work against its evidence and expected result.",
        status: "pending",
      },
      {
        id: `${id}-learn`,
        kind: "learn",
        title: "Capture the lesson",
        description: "Store the outcome and improve future skill recommendations.",
        status: "pending",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildGroundedAgentResult(
  run: AgentRun,
  actionSummary?: string,
) {
  if (actionSummary) return actionSummary;
  if (!run.evidence.length)
    return "BlackHole did not find enough verified local knowledge to complete this safely. Add relevant project notes or skills, then try again.";
  const points = run.evidence.slice(0, 4).map(
    (item, index) =>
      `${index + 1}. ${item.title.replace(/^(Skill|Reference|Vault) · /, "")} · ${item.heading}: ${item.excerpt}`,
  );
  const priorLessons = (run.appliedLessons || []).map(
    (item) =>
      `- ${item.outcome === "failed" ? "Avoid repeating" : "Reuse"}: ${item.lesson}`,
  );
  return [
    `Grounded plan for “${run.goal}”`,
    ...(priorLessons.length ? ["Prior lessons applied:", ...priorLessons] : []),
    ...points,
    "Use the cited local knowledge as the operating constraints. Mark the outcome after applying the plan so BlackHole can learn which skill stack worked.",
  ].join("\n\n");
}

export function buildLearningRecord(
  run: AgentRun,
  timestamp = new Date().toISOString(),
): LearningRecord {
  const skillLabel = run.skillIds.length
    ? `${run.skillIds.length} selected skills`
    : "project knowledge";
  const confidence = Math.min(
    0.82,
    Number((0.3 + run.evidence.length * 0.04 + run.skillIds.length * 0.025).toFixed(2)),
  );
  return {
    id: randomUUID(),
    runId: run.id,
    projectId: run.projectId,
    title: run.goal.length > 88 ? `${run.goal.slice(0, 85)}…` : run.goal,
    lesson: `For this objective, BlackHole used ${skillLabel}, ${run.evidence.length} evidence sources, and ${(run.appliedLessons || []).length} prior lessons. Outcome feedback will strengthen or weaken this recommendation for similar work.`,
    evidenceIds: unique(run.evidence.map((item) => item.memoryId)),
    skillIds: run.skillIds,
    outcome: run.outcome,
    confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function calculateSkillScore(
  current: SkillScore | undefined,
  skillId: string,
  outcome: AgentOutcome | "use",
  timestamp = new Date().toISOString(),
): SkillScore {
  const next: SkillScore = current
    ? { ...current }
    : {
        skillId,
        uses: 0,
        successes: 0,
        partials: 0,
        failures: 0,
        score: 0.5,
        lastUsedAt: timestamp,
      };
  if (outcome === "use") next.uses += 1;
  if (outcome === "success") next.successes += 1;
  if (outcome === "partial") next.partials += 1;
  if (outcome === "failed") next.failures += 1;
  const rated = next.successes + next.partials + next.failures;
  next.score = Number(
    ((1 + next.successes + next.partials * 0.55) / (2 + rated)).toFixed(3),
  );
  next.lastUsedAt = timestamp;
  return next;
}
