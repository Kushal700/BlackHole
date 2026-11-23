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
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1;
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

export function rankMemories(query: string, memories: Memory[], queryEmbedding?: number[]) {
  const queryWords = new Set(tokens(query));
  const vector = queryEmbedding || localEmbedding(query);
  return memories
    .filter((memory) => !memory.archived)
    .map((memory) => {
      const haystack = `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
      const lexicalHits = [...queryWords].filter((word) => haystack.includes(word)).length;
      const lexical = queryWords.size ? lexicalHits / queryWords.size : 0;
      const semantic = cosineSimilarity(vector, memory.embedding || localEmbedding(haystack));
      return { memory, score: semantic * 0.72 + lexical * 0.28 };
    })
    .sort((left, right) => right.score - left.score);
}

