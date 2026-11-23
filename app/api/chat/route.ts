import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { guard } from "@/lib/http";
import { createEmbedding, rankMemories } from "@/lib/semantic";
import { readStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = z.object({ message: z.string().min(1).max(12000) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "A message is required" }, { status: 400 });
  const store = await readStore();
  const embedding = await createEmbedding(parsed.data.message);
  const ranked = rankMemories(parsed.data.message, store.memories, embedding)
    .filter((item) => item.score > 0.1)
    .slice(0, 6);
  const citations = ranked.map(({ memory }) => ({
    id: memory.id,
    title: memory.title,
    category: memory.category,
    excerpt: memory.content.slice(0, 180),
  }));

  if (!ranked.length) {
    return NextResponse.json({
      answer: "I couldn’t find enough evidence in your saved memories to answer that. Add or import the relevant material, then ask me again.",
      citations: [],
      grounded: false,
    });
  }

  const context = ranked.map(({ memory }, index) =>
    `[${index + 1}] ${memory.title} (${memory.category}, ${memory.createdAt.slice(0, 10)})\n${memory.content}`
  ).join("\n\n");

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.responses.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-5-mini",
        instructions:
          "You are BlackHole, a personal memory assistant. Answer only from the supplied memory context. Cite claims using [1], [2], etc. If the evidence is incomplete, state that clearly. Never invent a memory.",
        input: `Question: ${parsed.data.message}\n\nMemory context:\n${context}`,
      });
      return NextResponse.json({ answer: response.output_text, citations, grounded: true });
    } catch {
      // Continue with the deterministic grounded response below.
    }
  }

  const answer = [
    `Here’s what your saved knowledge says about “${parsed.data.message}”:`,
    ...ranked.slice(0, 3).map(({ memory }, index) => `${index + 1}. **${memory.title}** — ${memory.content.slice(0, 260)}${memory.content.length > 260 ? "…" : ""} [${index + 1}]`),
    "I’m answering only from the memories cited below. Configure an OpenAI key for a more synthesized response.",
  ].join("\n\n");
  return NextResponse.json({ answer, citations, grounded: true });
}

