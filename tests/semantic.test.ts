import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  localEmbedding,
  rankMemories,
  rankMemoryChunks,
  splitMemoryIntoChunks,
} from "@/lib/semantic";
import type { Memory } from "@/lib/types";

const memory = (id: string, title: string, content: string): Memory => ({
  id,
  title,
  content,
  category: "note",
  tags: [],
  source: "test",
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  embedding: localEmbedding(`${title} ${content}`),
});

describe("local semantic retrieval", () => {
  it("creates normalized deterministic vectors", () => {
    const first = localEmbedding("Roblox boss combat");
    const second = localEmbedding("Roblox boss combat");
    expect(first).toEqual(second);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1, 5);
  });

  it("ranks relevant memories before unrelated memories", () => {
    const results = rankMemories("boss combat design", [
      memory("space", "Astronomy", "A note about distant galaxies"),
      memory(
        "boss",
        "Boss combat",
        "Designing readable attacks for the action RPG boss",
      ),
    ]);
    expect(results[0].memory.id).toBe("boss");
  });

  it("splits Markdown by heading and preserves citation line numbers", () => {
    const chunks = splitMemoryIntoChunks(
      memory(
        "guide",
        "Roblox Guide",
        "# Networking\nValidate every remote on the server.\n\n## Animation\nUse authored anticipation poses.",
      ),
    );
    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      "Networking",
      "Animation",
    ]);
    expect(chunks[1].lineStart).toBe(4);
  });

  it("retrieves the exact relevant section instead of the entire document", () => {
    const guide = memory(
      "guide",
      "Roblox Guide",
      "# Economy\nUse receipt idempotency for purchases.\n\n# Animation\nUse IK constraints for grounded feet.",
    );
    const result = rankMemoryChunks("receipt purchase idempotency", [guide], 1);
    expect(result[0].heading).toBe("Economy");
    expect(result[0].content).toContain("receipt idempotency");
  });
});
