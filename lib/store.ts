import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Connection,
  ConnectionType,
  ImportRecord,
  Memory,
  Project,
  StoreData,
  Task,
  ActionRecord,
} from "@/lib/types";
import {
  cosineSimilarity,
  createEmbedding,
  localEmbedding,
  rankMemories,
} from "@/lib/semantic";
import { readPostgresStore, writePostgresStore } from "@/lib/postgres-state";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIRECTORY, "blackhole.json");
const BACKUP_DIRECTORY = path.join(DATA_DIRECTORY, "backups");
const BACKUP_RETENTION = 24;
let writeQueue = Promise.resolve();

const now = "2026-11-22T09:00:00.000Z";

const seed: StoreData = {
  actions: [],
  projects: [
    {
      id: "project-blackhole",
      name: "BlackHole Second Brain",
      summary: "A cinematic, AI-powered personal knowledge universe.",
      goal: "Make accumulated knowledge searchable, connected, and useful every day.",
      status: "active",
      progress: 38,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "project-roblox",
      name: "Roblox Action RPG",
      summary: "An anime-inspired multiplayer action RPG with readable combat.",
      goal: "Ship a polished vertical slice with one complete boss encounter.",
      status: "active",
      progress: 61,
      createdAt: "2026-10-03T12:00:00.000Z",
      updatedAt: "2026-11-19T17:20:00.000Z",
    },
  ],
  memories: [
    {
      id: "memory-origin",
      title: "Why the second brain should feel like a universe",
      content:
        "Knowledge should feel alive, spatial, and discoverable. A black hole anchors the experience while memories orbit in project clusters. The visual metaphor matters because it encourages exploration instead of filing.",
      category: "idea",
      tags: ["vision", "universe", "product"],
      source: "Product note",
      projectId: "project-blackhole",
      archived: false,
      createdAt: "2026-11-18T16:30:00.000Z",
      updatedAt: "2026-11-18T16:30:00.000Z",
    },
    {
      id: "memory-rag",
      title: "RAG citation rule",
      content:
        "The assistant must cite saved memories and say when the vault does not contain enough evidence. It must never imply access to conversations that were not deliberately imported.",
      category: "decision",
      tags: ["ai", "rag", "trust"],
      source: "Architecture decision",
      projectId: "project-blackhole",
      archived: false,
      createdAt: "2026-11-20T10:15:00.000Z",
      updatedAt: "2026-11-20T10:15:00.000Z",
    },
    {
      id: "memory-rpg-combat",
      title: "Combat readability over particle density",
      content:
        "For the Roblox RPG vertical slice, prioritize strong silhouettes, anticipation frames, hit-stop, and clear danger zones. Avoid covering boss tells with dense particles.",
      category: "decision",
      tags: ["roblox", "combat", "vfx"],
      source: "Design session",
      projectId: "project-roblox",
      archived: false,
      createdAt: "2026-11-16T14:00:00.000Z",
      updatedAt: "2026-11-16T14:00:00.000Z",
    },
    {
      id: "memory-boss",
      title: "First boss: The Ashen Ronin",
      content:
        "The first boss has three phases: measured sword duels, arena-wide flame lanes, then a desperate mixed phase. The encounter teaches parry timing before testing positioning.",
      category: "project",
      tags: ["roblox", "boss", "milestone"],
      source: "Project brief",
      projectId: "project-roblox",
      archived: false,
      createdAt: "2026-11-13T09:40:00.000Z",
      updatedAt: "2026-11-19T17:20:00.000Z",
    },
    {
      id: "memory-import",
      title: "Importer duplicate strategy",
      content:
        "Detect exact duplicates using normalized content hashes. Flag near-duplicates by title and semantic similarity, but preserve the original source and import history.",
      category: "research",
      tags: ["imports", "duplicates", "architecture"],
      source: "Engineering note",
      projectId: "project-blackhole",
      archived: false,
      createdAt: "2026-11-21T11:10:00.000Z",
      updatedAt: "2026-11-21T11:10:00.000Z",
    },
    {
      id: "memory-next",
      title: "Next milestone for BlackHole",
      content:
        "Complete the memory CRUD flow, connect semantic search to chat, and validate the 3D graph with a few hundred nodes before expanding the importer.",
      category: "task",
      tags: ["milestone", "next", "engineering"],
      source: "Planning note",
      projectId: "project-blackhole",
      archived: false,
      createdAt: "2026-11-22T08:30:00.000Z",
      updatedAt: "2026-11-22T08:30:00.000Z",
    },
  ],
  connections: [
    {
      id: "connection-1",
      sourceId: "memory-origin",
      targetId: "memory-rag",
      type: "belongs_to_project",
      score: 0.91,
      automatic: true,
      createdAt: now,
    },
    {
      id: "connection-2",
      sourceId: "memory-rpg-combat",
      targetId: "memory-boss",
      type: "related_to",
      score: 0.94,
      automatic: true,
      createdAt: now,
    },
    {
      id: "connection-3",
      sourceId: "memory-import",
      targetId: "memory-next",
      type: "depends_on",
      score: 0.72,
      automatic: true,
      createdAt: now,
    },
  ],
  tasks: [
    {
      id: "task-boss",
      title: "Prototype Ashen Ronin phase two",
      description: "Block out flame lanes and telegraphs.",
      status: "in_progress",
      priority: "high",
      projectId: "project-roblox",
      dueDate: "2026-11-27",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-import",
      title: "Import old design notes",
      description: "Bring the Markdown archive into BlackHole.",
      status: "todo",
      priority: "medium",
      projectId: "project-blackhole",
      dueDate: "2026-11-30",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-rule",
      title: "Write citation trust tests",
      description:
        "Verify that empty retrieval never produces invented claims.",
      status: "done",
      priority: "high",
      projectId: "project-blackhole",
      createdAt: now,
      updatedAt: now,
    },
  ],
  imports: [],
};

function hydrate(input: StoreData): StoreData {
  return {
    ...input,
    actions: input.actions || [],
    memories: input.memories.map((memory) => ({
      ...memory,
      embedding:
        memory.embedding ||
        localEmbedding(
          `${memory.title} ${memory.content} ${memory.tags.join(" ")}`,
        ),
    })),
  };
}

async function ensureStore() {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(hydrate(seed), null, 2),
      "utf8",
    );
  }
}

function backupFilename(label: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${label.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${timestamp}.json`;
}

async function pruneBackups() {
  const entries = (
    await fs.readdir(BACKUP_DIRECTORY, { withFileTypes: true })
  ).filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
  const dated = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      modified: (await fs.stat(path.join(BACKUP_DIRECTORY, entry.name)))
        .mtimeMs,
    })),
  );
  dated.sort((left, right) => right.modified - left.modified);
  await Promise.all(
    dated
      .slice(BACKUP_RETENTION)
      .map(({ entry }) => fs.unlink(path.join(BACKUP_DIRECTORY, entry.name))),
  );
}

async function writeBackupSnapshot(data: StoreData, label: string) {
  await fs.mkdir(BACKUP_DIRECTORY, { recursive: true });
  const filename = backupFilename(label);
  await fs.writeFile(
    path.join(BACKUP_DIRECTORY, filename),
    JSON.stringify(data, null, 2),
    "utf8",
  );
  await pruneBackups();
  return filename;
}

async function ensureDailyBackup() {
  await fs.mkdir(BACKUP_DIRECTORY, { recursive: true });
  const prefix = `auto-${new Date().toISOString().slice(0, 10)}`;
  const entries = await fs.readdir(BACKUP_DIRECTORY);
  if (entries.some((entry) => entry.startsWith(prefix))) return;
  try {
    const current = JSON.parse(
      await fs.readFile(DATA_FILE, "utf8"),
    ) as StoreData;
    await writeBackupSnapshot(current, prefix);
  } catch {
    /* A brand-new store has nothing to preserve yet. */
  }
}

export async function readStore() {
  if (process.env.DATABASE_URL)
    return hydrate(await readPostgresStore(hydrate(seed)));
  await ensureStore();
  return hydrate(JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as StoreData);
}

export async function writeStore(data: StoreData) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      if (process.env.DATABASE_URL) {
        await writePostgresStore(data);
        return;
      }
      await ensureStore();
      await ensureDailyBackup();
      const temporary = `${DATA_FILE}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(temporary, DATA_FILE);
    });
  await writeQueue;
}

export async function listBackups() {
  await fs.mkdir(BACKUP_DIRECTORY, { recursive: true });
  const entries = await fs.readdir(BACKUP_DIRECTORY, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(BACKUP_DIRECTORY, entry.name));
        return {
          filename: entry.name,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          automatic: entry.name.startsWith("auto-"),
        };
      }),
  );
  return backups.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export async function createBackup(label = "manual") {
  const data = await readStore();
  const filename = await writeBackupSnapshot(data, label);
  return (await listBackups()).find((backup) => backup.filename === filename)!;
}

export async function previewBackup(filename: string) {
  if (path.basename(filename) !== filename || !filename.endsWith(".json"))
    throw new Error("Invalid backup filename.");
  const data = JSON.parse(
    await fs.readFile(path.join(BACKUP_DIRECTORY, filename), "utf8"),
  ) as StoreData;
  if (
    !Array.isArray(data.memories) ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.connections)
  )
    throw new Error("Backup is not a valid BlackHole store.");
  return {
    filename,
    memories: data.memories.length,
    projects: data.projects.length,
    tasks: data.tasks.length,
    connections: data.connections.length,
    actions: data.actions?.length || 0,
  };
}

export async function restoreBackup(filename: string) {
  const preview = await previewBackup(filename);
  const safetyBackup = await createBackup("before-restore");
  const data = JSON.parse(
    await fs.readFile(path.join(BACKUP_DIRECTORY, filename), "utf8"),
  ) as StoreData;
  await writeStore(hydrate(data));
  return { preview, safetyBackup: safetyBackup.filename };
}

export async function listMemories(query = "", includeArchived = false) {
  const store = await readStore();
  const filtered = includeArchived
    ? store.memories
    : store.memories.filter((memory) => !memory.archived);
  if (!query.trim())
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rankMemories(query, filtered)
    .filter((item) => item.score > 0.08)
    .map((item) => item.memory);
}

export async function getMemory(id: string) {
  const store = await readStore();
  return store.memories.find((memory) => memory.id === id);
}

type MemoryInput = Omit<Memory, "id" | "createdAt" | "updatedAt" | "embedding">;

export async function createMemory(input: MemoryInput) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const embedding = await createEmbedding(
    `${input.title}\n${input.content}\n${input.tags.join(" ")}`,
  );
  const memory: Memory = {
    ...input,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    embedding,
  };
  const candidates = store.memories
    .map((item) => ({
      item,
      score: cosineSimilarity(
        embedding,
        item.embedding || localEmbedding(item.content),
      ),
    }))
    .filter(({ score }) => score >= 0.32)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  store.memories.unshift(memory);
  for (const candidate of candidates) {
    const type: ConnectionType =
      input.projectId && input.projectId === candidate.item.projectId
        ? "belongs_to_project"
        : "related_to";
    store.connections.push({
      id: randomUUID(),
      sourceId: memory.id,
      targetId: candidate.item.id,
      type,
      score: candidate.score,
      automatic: true,
      createdAt: timestamp,
    });
  }
  await writeStore(store);
  return { memory, connections: candidates.length };
}

export async function updateMemory(id: string, patch: Partial<MemoryInput>) {
  const store = await readStore();
  const index = store.memories.findIndex((memory) => memory.id === id);
  if (index < 0) return undefined;
  const next = {
    ...store.memories[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  next.embedding = await createEmbedding(
    `${next.title}\n${next.content}\n${next.tags.join(" ")}`,
  );
  store.memories[index] = next;
  await writeStore(store);
  return next;
}

export async function deleteMemory(id: string) {
  const store = await readStore();
  const before = store.memories.length;
  store.memories = store.memories.filter((memory) => memory.id !== id);
  store.connections = store.connections.filter(
    (item) => item.sourceId !== id && item.targetId !== id,
  );
  if (store.memories.length === before) return false;
  await writeStore(store);
  return true;
}

export async function createConnection(
  sourceId: string,
  targetId: string,
  type: ConnectionType,
) {
  const store = await readStore();
  const connection: Connection = {
    id: randomUUID(),
    sourceId,
    targetId,
    type,
    score: 1,
    automatic: false,
    createdAt: new Date().toISOString(),
  };
  store.connections.push(connection);
  await writeStore(store);
  return connection;
}

export async function removeConnection(id: string) {
  const store = await readStore();
  store.connections = store.connections.filter((item) => item.id !== id);
  await writeStore(store);
}

export async function createProject(
  input: Pick<Project, "name" | "summary" | "goal">,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const project: Project = {
    ...input,
    id: randomUUID(),
    status: "active",
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.projects.unshift(project);
  await writeStore(store);
  return project;
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const store = await readStore();
  const index = store.projects.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  store.projects[index] = {
    ...store.projects[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.projects[index];
}

export async function createTask(
  input: Omit<Task, "id" | "createdAt" | "updatedAt">,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const task: Task = {
    ...input,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.tasks.unshift(task);
  await writeStore(store);
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const store = await readStore();
  const index = store.tasks.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  store.tasks[index] = {
    ...store.tasks[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.tasks[index];
}

export async function addImport(
  record: Omit<ImportRecord, "id" | "createdAt">,
) {
  const store = await readStore();
  const item: ImportRecord = {
    ...record,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  store.imports.unshift(item);
  await writeStore(store);
  return item;
}

export async function recordAction(record: ActionRecord) {
  const store = await readStore();
  store.actions = [record, ...(store.actions || [])].slice(0, 250);
  await writeStore(store);
  return record;
}

export async function clearStore() {
  const empty: StoreData = {
    memories: [],
    connections: [],
    projects: [],
    tasks: [],
    imports: [],
    actions: [],
  };
  await writeStore(empty);
}

export function withoutEmbedding(memory: Memory): Omit<Memory, "embedding"> {
  const publicMemory = { ...memory };
  delete publicMemory.embedding;
  return publicMemory;
}
