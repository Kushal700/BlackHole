import type { ActionProposal } from "@/lib/types";

function clean(value: string) {
  return value.trim().replace(/[.?!]+$/, "");
}

export function parseActionRequest(
  message: string,
): ActionProposal | undefined {
  const value = message.trim();
  const sync = value.match(
    /^(?:please\s+)?sync\s+(?:my\s+|the\s+)?(?:skills|vault|library|knowledge)(?:\s+now)?[.!]?$/i,
  );
  if (sync)
    return {
      kind: "sync_library",
      title: "Synchronize local knowledge",
      description:
        "Scan installed Codex skills, reference guides, and the configured Obsidian vault, then update BlackHole memory and graph links.",
      risk: "low",
      payload: {},
    };

  const progress = value.match(
    /^(?:please\s+)?set\s+(?:the\s+)?(.+?)\s+project\s+progress\s+to\s+(\d{1,3})%?[.!]?$/i,
  );
  if (progress) {
    const amount = Math.max(0, Math.min(100, Number(progress[2])));
    return {
      kind: "update_project_progress",
      title: `Set ${clean(progress[1])} progress to ${amount}%`,
      description: "Update the matching project progress after confirmation.",
      risk: "medium",
      payload: { projectName: clean(progress[1]), progress: amount },
    };
  }

  const task = value.match(
    /^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?task(?:\s+(?:to|called|named))?\s*[:\-]?\s*(.+)$/i,
  );
  if (task) {
    const title = clean(
      task[1].replace(
        /\s+(?:as\s+)?(?:a\s+)?(?:high|medium|low)\s+priority$/i,
        "",
      ),
    );
    const priority = /high\s+priority/i.test(task[1])
      ? "high"
      : /low\s+priority/i.test(task[1])
        ? "low"
        : "medium";
    return {
      kind: "create_task",
      title: `Create task · ${title}`,
      description:
        "Add a new task to BlackHole. You can assign it to a project afterward.",
      risk: "low",
      payload: { title, description: "Created by BlackHole Jarvis", priority },
    };
  }

  const memory = value.match(
    /^(?:please\s+)?remember(?:\s+that)?\s*[:\-]?\s*(.+)$/i,
  );
  if (memory) {
    const content = clean(memory[1]);
    const title = content.length > 72 ? `${content.slice(0, 69)}…` : content;
    return {
      kind: "create_memory",
      title: `Remember · ${title}`,
      description:
        "Save this as a permanent note and connect it to related knowledge.",
      risk: "low",
      payload: { title, content },
    };
  }
  return undefined;
}
