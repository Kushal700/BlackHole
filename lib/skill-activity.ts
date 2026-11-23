import type { Memory } from "@/lib/types";

export const SKILL_GLOW_WINDOW_MS = 15 * 60 * 1000;

export function isSkillMemory(memory: Pick<Memory, "tags">) {
  return memory.tags.includes("skill") || memory.tags.includes("codex-skill");
}

export function skillActivityStrength(
  memory: Pick<Memory, "lastUsedAt">,
  now = Date.now(),
) {
  if (!memory.lastUsedAt) return 0;
  const usedAt = Date.parse(memory.lastUsedAt);
  if (!Number.isFinite(usedAt)) return 0;
  return Math.max(0, Math.min(1, 1 - (now - usedAt) / SKILL_GLOW_WINDOW_MS));
}
