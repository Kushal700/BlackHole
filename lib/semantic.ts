import OpenAI from "openai";
import type { Memory } from "@/lib/types";

const DIMENSIONS = 96;

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function localEmbedding(value: string) {
  const vector = Array.from({ length: DIMENSIONS }, () => 0);
  const words = tokens(value);
  for (const word of words) {
    const hash = hashToken(word);
    vector[hash % DIMENSIONS] += 1;
    vector[(hash >>> 8) % DIMENSIONS] += 0.35;
  }
  const magnitude =
    Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1;
  return vector.map((item) => item / magnitude);
}

export async function createEmbedding(value: string) {
  if (!process.env.OPENAI_API_KEY) return localEmbedding(value);
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: value.slice(0, 24000),
    });
    return result.data[0].embedding;
  } catch {
    return localEmbedding(value);
  }
}

export async function createEmbeddings(values: string[]) {
  if (!values.length) return [];
  if (!process.env.OPENAI_API_KEY) return values.map(localEmbedding);
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: values.map((value) => value.slice(0, 8000)),
    });
    return result.data
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
  } catch {
    return values.map(localEmbedding);
  }
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function rankMemories(
  query: string,
  memories: Memory[],
  queryEmbedding?: number[],
) {
  const queryWords = new Set(tokens(query));
  const vector = queryEmbedding || localEmbedding(query);
  return memories
    .filter((memory) => !memory.archived)
    .map((memory) => {
      const haystack =
        `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
      const lexicalHits = [...queryWords].filter((word) =>
        haystack.includes(word),
      ).length;
      const lexical = queryWords.size ? lexicalHits / queryWords.size : 0;
      const semantic = cosineSimilarity(
        vector,
        memory.embedding || localEmbedding(haystack),
      );
      return { memory, score: semantic * 0.72 + lexical * 0.28 };
    })
    .sort((left, right) => right.score - left.score);
}

export interface RankedMemoryChunk {
  memory: Memory;
  heading: string;
  lineStart: number;
  content: string;
  score: number;
}

function stripFrontmatter(value: string) {
  return value.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");
}

export function splitMemoryIntoChunks(memory: Memory, maxLength = 1800) {
  const lines = stripFrontmatter(memory.content).split(/\r?\n/);
  const sections: Array<{
    heading: string;
    lineStart: number;
    lines: string[];
  }> = [];
  let current = {
    heading: memory.title.replace(/^(Skill|Reference|Vault) · /, ""),
    lineStart: 1,
    lines: [] as string[],
  };
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      if (current.lines.some((line) => line.trim())) sections.push(current);
      current = { heading: heading[1].trim(), lineStart: index + 1, lines: [] };
    } else current.lines.push(lines[index]);
  }
  if (current.lines.some((line) => line.trim())) sections.push(current);
  if (!sections.length)
    sections.push({ heading: memory.title, lineStart: 1, lines });

  return sections.flatMap((section) => {
    const paragraphs = section.lines
      .join("\n")
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);
    const chunks: Array<{
      heading: string;
      lineStart: number;
      content: string;
    }> = [];
    let buffer = "";
    let offset = 0;
    for (const paragraph of paragraphs) {
      if (buffer && buffer.length + paragraph.length + 2 > maxLength) {
        chunks.push({
          heading: section.heading,
          lineStart: section.lineStart + offset,
          content: buffer,
        });
        offset += buffer.split(/\r?\n/).length;
        buffer = "";
      }
      if (paragraph.length > maxLength) {
        for (let start = 0; start < paragraph.length; start += maxLength) {
          const slice = paragraph.slice(start, start + maxLength).trim();
          if (slice)
            chunks.push({
              heading: section.heading,
              lineStart: section.lineStart + offset,
              content: slice,
            });
          offset += slice.split(/\r?\n/).length;
        }
      } else buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
    if (buffer)
      chunks.push({
        heading: section.heading,
        lineStart: section.lineStart + offset,
        content: buffer,
      });
    return chunks;
  });
}

export function rankMemoryChunks(
  query: string,
  memories: Memory[],
  limit = 10,
): RankedMemoryChunk[] {
  const queryTokens = tokens(query);
  const queryWords = new Set(queryTokens);
  const vector = localEmbedding(query);
  const normalizedQuery = query.toLowerCase().trim();
  const ranked = memories
    .filter((memory) => !memory.archived)
    .flatMap((memory) =>
      splitMemoryIntoChunks(memory).map((chunk) => {
        const title = `${memory.title} ${chunk.heading}`.toLowerCase();
        const haystack =
          `${title} ${memory.tags.join(" ")} ${chunk.content}`.toLowerCase();
        const lexicalHits = [...queryWords].filter((word) =>
          haystack.includes(word),
        ).length;
        const lexical = queryWords.size ? lexicalHits / queryWords.size : 0;
        const semantic = cosineSimilarity(vector, localEmbedding(haystack));
        const titleSignal =
          normalizedQuery &&
          (title.includes(normalizedQuery) ||
            queryTokens.some((word) => title.includes(word)))
            ? 1
            : 0;
        return {
          memory,
          ...chunk,
          score: semantic * 0.56 + lexical * 0.34 + titleSignal * 0.1,
        };
      }),
    )
    .sort((left, right) => right.score - left.score);

  const selected: RankedMemoryChunk[] = [];
  const perMemory = new Map<string, number>();
  for (const candidate of ranked) {
    if (candidate.score < 0.1) break;
    const count = perMemory.get(candidate.memory.id) || 0;
    if (count >= 2) continue;
    selected.push(candidate);
    perMemory.set(candidate.memory.id, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}
