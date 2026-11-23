import { describe, expect, it } from "vitest";
import {
  buildAgentRun,
  calculateSkillScore,
  createPlaybookFromRun,
  filterSkillPool,
  rankLearningRecords,
  rankPlaybooks,
  rerankSkillsWithExperience,
} from "@/lib/agent";
import type { LearningRecord, Memory, SkillScore } from "@/lib/types";

const timestamp = "2026-11-22T12:00:00.000Z";

function memory(id: string, title: string, tags: string[]): Memory {
  return {
    id,
    title,
    content: "Verified operational guidance.",
    category: "document",
    tags,
    source: "test",
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("BlackHole agent", () => {
  it("builds an approval-gated plan with evidence and selected skills", () => {
    const skill = memory("skill-1", "Skill · Roblox Security", ["skill"]);
    const note = memory("note-1", "Boss design decision", ["boss"]);
    const run = buildAgentRun({
      id: "run-1",
      timestamp,
      goal: "Plan a secure boss encounter",
      projectId: "project-roblox",
      ranked: [
        { memory: skill, heading: "Validate remotes", lineStart: 4, content: skill.content, score: 0.82 },
        { memory: note, heading: "Readability", lineStart: 1, content: note.content, score: 0.68 },
      ],
    });

    expect(run.status).toBe("awaiting_approval");
    expect(run.skillIds).toEqual(["skill-1"]);
    expect(run.evidence).toHaveLength(2);
    expect(run.steps.find((step) => step.kind === "act")?.requiresApproval).toBe(true);
  });

  it("strengthens successful skills and weakens failed ones", () => {
    const used = calculateSkillScore(undefined, "skill-1", "use", timestamp);
    const successful = calculateSkillScore(used, "skill-1", "success", timestamp);
    const failed = calculateSkillScore(used, "skill-1", "failed", timestamp);

    expect(used.uses).toBe(1);
    expect(successful.score).toBeGreaterThan(used.score);
    expect(failed.score).toBeLessThan(used.score);
  });

  it("keeps unrelated skills out of Roblox project plans", () => {
    const skills = [
      memory("roblox", "Skill · Roblox Networking Security", ["skill"]),
      memory("video", "Skill · YouTube Packaging", ["skill"]),
    ];
    const selected = filterSkillPool("Roblox Action RPG", skills);

    expect(selected.map((item) => item.id)).toEqual(["roblox"]);
  });

  it("recalls project lessons and carries written corrections forward", () => {
    const records: LearningRecord[] = [
      {
        id: "lesson-1",
        runId: "run-1",
        projectId: "project-roblox",
        title: "Readable boss encounter",
        lesson: "Use the combat and VFX skill stack.",
        feedback: "Reduce the flame lane brightness on mobile.",
        evidenceIds: [],
        skillIds: [],
        outcome: "partial",
        confidence: 0.72,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "lesson-2",
        runId: "run-2",
        projectId: "another-project",
        title: "Marketing page",
        lesson: "Use a brighter hero.",
        evidenceIds: [],
        skillIds: [],
        outcome: "success",
        confidence: 0.9,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];

    const ranked = rankLearningRecords(
      "Improve boss flame lanes for mobile readability",
      records,
      "project-roblox",
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].lesson).toContain("Reduce the flame lane brightness");
  });

  it("uses rated skill experience as a bounded ranking signal", () => {
    const good = memory("good", "Skill · Roblox Combat", ["skill", "roblox"]);
    const bad = memory("bad", "Skill · Roblox VFX", ["skill", "roblox"]);
    const ranked = [
      { memory: bad, heading: "VFX", lineStart: 1, content: bad.content, score: 0.7 },
      { memory: good, heading: "Combat", lineStart: 1, content: good.content, score: 0.7 },
    ];
    const scores: SkillScore[] = [
      { skillId: "good", uses: 5, successes: 4, partials: 0, failures: 0, score: 0.9, lastUsedAt: timestamp },
      { skillId: "bad", uses: 5, successes: 0, partials: 0, failures: 4, score: 0.2, lastUsedAt: timestamp },
    ];

    expect(rerankSkillsWithExperience(ranked, scores)[0].memory.id).toBe("good");
  });

  it("promotes a successful run and reuses its playbook for similar goals", () => {
    const skill = memory("skill-1", "Skill · Roblox Boss Design", ["skill", "roblox"]);
    const planned = buildAgentRun({
      id: "run-playbook",
      timestamp,
      goal: "Build a readable Roblox boss encounter",
      projectId: "project-roblox",
      ranked: [
        { memory: skill, heading: "Boss loop", lineStart: 1, content: skill.content, score: 0.8 },
      ],
    });
    const completed = { ...planned, status: "completed" as const, outcome: "success" as const };
    const playbook = createPlaybookFromRun(completed, "Readable boss workflow", timestamp);
    const reused = rankPlaybooks(
      "Plan another readable boss fight",
      [playbook],
      "project-roblox",
    );

    expect(playbook.steps.length).toBeGreaterThan(2);
    expect(reused[0].id).toBe(playbook.id);
    expect(reused[0].relevance).toBeGreaterThan(0.22);
  });
});
