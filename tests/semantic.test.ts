import { describe, expect, it } from "vitest";
import { cosineSimilarity, localEmbedding, rankMemories } from "@/lib/semantic";
import type { Memory } from "@/lib/types";

const memory = (id: string, title: string, content: string): Memory => ({
  id, title, content, category: "note", tags: [], source: "test", archived: false,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
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
      memory("boss", "Boss combat", "Designing readable attacks for the action RPG boss"),
    ]);
    expect(results[0].memory.id).toBe("boss");
  });
});

