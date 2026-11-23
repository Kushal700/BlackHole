import { createMemory, createTask, readStore, updateProject } from "@/lib/store";
import { syncSkills } from "@/lib/skills";
import type { ActionProposal } from "@/lib/types";

export async function executeActionProposal(proposal: ActionProposal) {
  let summary = "Action completed.";
  let result: unknown;
  if (proposal.kind === "create_task") {
    const store = await readStore();
    const projectName = String(proposal.payload.projectName || "");
    const project = projectName
      ? store.projects.find((item) =>
          item.name.toLowerCase().includes(projectName.toLowerCase()),
        )
      : store.projects.find((item) => item.id === store.activeProjectId);
    const title = String(proposal.payload.title || proposal.title);
    const requestedPriority = String(proposal.payload.priority || "medium");
    const priority = ["low", "medium", "high"].includes(requestedPriority)
      ? (requestedPriority as "low" | "medium" | "high")
      : "medium";
    result = await createTask({
      title,
      description: String(
        proposal.payload.description || "Created by BlackHole Agent",
      ),
      priority,
      status: "todo",
      projectId: project?.id,
    });
    summary = `Created task “${title}”${project ? ` in ${project.name}` : ""}.`;
  } else if (proposal.kind === "create_memory") {
    const title = String(proposal.payload.title || proposal.title);
    result = await createMemory({
      title,
      content: String(proposal.payload.content || ""),
      category: "note",
      tags: ["agent", "captured"],
      source: "BlackHole Agent",
      archived: false,
    });
    summary = `Saved memory “${title}”.`;
  } else if (proposal.kind === "update_project_progress") {
    const store = await readStore();
    const projectName = String(proposal.payload.projectName || "");
    const project = store.projects.find((item) =>
      item.name.toLowerCase().includes(projectName.toLowerCase()),
    );
    if (!project) throw new Error(`No project matched “${projectName}”.`);
    const progress = Number(proposal.payload.progress);
    result = await updateProject(project.id, { progress });
    summary = `Updated ${project.name} to ${progress}%.`;
  } else {
    result = await syncSkills();
    summary = "Synchronized installed skills, references, and vault notes.";
  }
  return { summary, result };
}

