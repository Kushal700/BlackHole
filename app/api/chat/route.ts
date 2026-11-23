import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { guard } from "@/lib/http";
import { rankMemoryChunks } from "@/lib/semantic";
import { readStore } from "@/lib/store";
import { parseActionRequest } from "@/lib/actions";

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = z.object({ message: z.string().min(1).max(12000) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "A message is required" }, { status: 400 });
  const proposedAction = parseActionRequest(parsed.data.message);
  if (proposedAction) return NextResponse.json({ answer: "I can do that. Review the proposed action below before I change anything.", citations: [], grounded: true, proposedAction });
  const store = await readStore();
  const ranked = rankMemoryChunks(parsed.data.message, store.memories, 8);
  const citations = ranked.map(({ memory, heading, lineStart, content }) => ({
    id: memory.id,
    title: memory.title,
    category: memory.category,
    heading,
    lineStart,
    excerpt: content.slice(0, 220),
    source: memory.source,
    sourceUrl: memory.sourceUrl,
  }));

  if (!ranked.length) {
    return NextResponse.json({
      answer: "I couldn’t find enough evidence in your saved memories to answer that. Add or import the relevant material, then ask me again.",
      citations: [],
      grounded: false,
    });
  }

  const context = ranked.map(({ memory, heading, lineStart, content }, index) =>
    `[${index + 1}] ${memory.title} > ${heading} (line ${lineStart}; ${memory.category}; ${memory.createdAt.slice(0, 10)})\n${content}`
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
    ...ranked.slice(0, 4).map(({ memory, heading, content }, index) => `${index + 1}. **${memory.title} · ${heading}** — ${content.slice(0, 300)}${content.length > 300 ? "…" : ""} [${index + 1}]`),
    "I’m answering only from the memories cited below. Configure an OpenAI key for a more synthesized response.",
  ].join("\n\n");
  return NextResponse.json({ answer, citations, grounded: true });
}
