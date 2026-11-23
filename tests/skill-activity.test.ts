import { describe, expect, it } from "vitest";
import {
  isSkillMemory,
  skillActivityStrength,
  SKILL_GLOW_WINDOW_MS,
} from "@/lib/skill-activity";

describe("skill activity glow", () => {
  it("recognizes installed skill memories", () => {
    expect(isSkillMemory({ tags: ["codex-skill", "roblox"] })).toBe(true);
    expect(isSkillMemory({ tags: ["note"] })).toBe(false);
  });

  it("fades activity over the glow window", () => {
    const now = Date.parse("2026-11-22T12:00:00.000Z");
    expect(
      skillActivityStrength({ lastUsedAt: new Date(now).toISOString() }, now),
    ).toBe(1);
    expect(
      skillActivityStrength(
        { lastUsedAt: new Date(now - SKILL_GLOW_WINDOW_MS / 2).toISOString() },
        now,
      ),
    ).toBeCloseTo(0.5);
    expect(
      skillActivityStrength(
        { lastUsedAt: new Date(now - SKILL_GLOW_WINDOW_MS).toISOString() },
        now,
      ),
    ).toBe(0);
  });
});
