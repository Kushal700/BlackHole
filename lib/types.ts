export const MEMORY_CATEGORIES = [
  "idea",
  "note",
  "project",
  "decision",
  "research",
  "conversation",
  "document",
  "task",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type ConnectionType =
  | "related_to"
  | "depends_on"
  | "contradicts"
  | "belongs_to_project";

export interface Memory {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  tags: string[];
  source: string;
  sourceUrl?: string;
  projectId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  embedding?: number[];
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: ConnectionType;
  score: number;
  automatic: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  summary: string;
  goal: string;
  status: "active" | "paused" | "completed";
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  projectId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  type: string;
  status: "completed" | "partial" | "failed";
  importedCount: number;
  duplicateCount: number;
  createdAt: string;
}

export interface StoreData {
  memories: Memory[];
  connections: Connection[];
  projects: Project[];
  tasks: Task[];
  imports: ImportRecord[];
}

export interface ChatCitation {
  id: string;
  title: string;
  category: MemoryCategory;
  excerpt: string;
}

