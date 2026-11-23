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
  "related_to" | "depends_on" | "contradicts" | "belongs_to_project";

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
  lastUsedAt?: string;
  usageCount?: number;
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
  currentObjective?: string;
  repositoryUrl?: string;
  releaseStage?: "prototype" | "vertical_slice" | "alpha" | "beta" | "live";
}

export interface StudioConnection {
  studioId: string;
  name: string;
  mode: "Edit" | "Play";
  placeId?: number;
  universeId?: number;
  persistedToCloud: boolean;
  projectId?: string;
  lastSeenAt: string;
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

export type ActionKind =
  "create_task" | "create_memory" | "update_project_progress" | "sync_library";

export interface ActionProposal {
  kind: ActionKind;
  title: string;
  description: string;
  risk: "low" | "medium";
  payload: Record<string, string | number | undefined>;
}

export interface ActionRecord {
  id: string;
  kind: ActionKind;
  title: string;
  status: "completed" | "failed";
  summary: string;
  createdAt: string;
}

export type AgentRunStatus =
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "verifying"
  | "learning"
  | "completed"
  | "rejected"
  | "failed";

export type AgentStepStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "failed";

export type AgentOutcome = "unrated" | "success" | "partial" | "failed";

export interface AgentStep {
  id: string;
  kind: "understand" | "recall" | "skills" | "act" | "verify" | "learn";
  title: string;
  description: string;
  status: AgentStepStatus;
  requiresApproval?: boolean;
}

export interface AgentEvidence {
  memoryId: string;
  title: string;
  heading: string;
  excerpt: string;
  score: number;
}

export interface AgentAppliedLesson {
  id: string;
  title: string;
  lesson: string;
  outcome: AgentOutcome;
  confidence: number;
  relevance: number;
}

export interface AgentPlaybook {
  id: string;
  name: string;
  description: string;
  trigger: string;
  projectId?: string;
  steps: string[];
  skillIds: string[];
  sourceRunId: string;
  confidence: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentAppliedPlaybook extends AgentPlaybook {
  relevance: number;
}

export interface AgentRun {
  id: string;
  goal: string;
  projectId?: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  skillIds: string[];
  evidence: AgentEvidence[];
  appliedLessons?: AgentAppliedLesson[];
  appliedPlaybooks?: AgentAppliedPlaybook[];
  proposedAction?: ActionProposal;
  result?: string;
  verification?: string;
  outcome: AgentOutcome;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LearningRecord {
  id: string;
  runId: string;
  projectId?: string;
  title: string;
  lesson: string;
  evidenceIds: string[];
  skillIds: string[];
  outcome: AgentOutcome;
  confidence: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillScore {
  skillId: string;
  uses: number;
  successes: number;
  partials: number;
  failures: number;
  score: number;
  lastUsedAt: string;
}

export interface StoreData {
  memories: Memory[];
  connections: Connection[];
  projects: Project[];
  tasks: Task[];
  imports: ImportRecord[];
  actions?: ActionRecord[];
  agentRuns?: AgentRun[];
  learningRecords?: LearningRecord[];
  skillScores?: SkillScore[];
  agentPlaybooks?: AgentPlaybook[];
  activeProjectId?: string;
  studioConnection?: StudioConnection;
}

export interface ChatCitation {
  id: string;
  title: string;
  category: MemoryCategory;
  excerpt: string;
  heading?: string;
  lineStart?: number;
  source?: string;
  sourceUrl?: string;
}
