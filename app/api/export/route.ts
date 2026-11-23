import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { readStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  const format = request.nextUrl.searchParams.get("format") || "json";
  if (format === "markdown") {
    const markdown = store.memories.map((memory) =>
      `# ${memory.title}\n\n- Category: ${memory.category}\n- Tags: ${memory.tags.join(", ")}\n- Source: ${memory.source}\n- Updated: ${memory.updatedAt}\n\n${memory.content}`
    ).join("\n\n---\n\n");
    return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown", "Content-Disposition": "attachment; filename=blackhole-export.md" } });
  }
  return new NextResponse(JSON.stringify(store, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=blackhole-export.json" } });
}

