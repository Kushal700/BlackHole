import { NextResponse } from "next/server";
import { guard } from "@/lib/http";
import { readStore, withoutEmbedding } from "@/lib/store";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  return NextResponse.json({
    memories: store.memories.filter((item) => !item.archived).length,
    connections: store.connections.length,
    activeProjects: store.projects.filter((item) => item.status === "active").length,
    openTasks: store.tasks.filter((item) => item.status !== "done").length,
    recent: store.memories.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map(withoutEmbedding),
    projects: store.projects,
    tasks: store.tasks,
  });
}
