import { describe, expect, it } from "vitest";
import {
  buildAgentRun,
  calculateSkillScore,
  filterSkillPool,
} from "@/lib/agent";
import type { Memory } from "@/lib/types";

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
});
