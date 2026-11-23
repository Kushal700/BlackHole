import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cosineSimilarity, createEmbeddings, localEmbedding } from "@/lib/semantic";
import { readStore, writeStore, withoutEmbedding } from "@/lib/store";
import type { Connection, Memory } from "@/lib/types";

const MAX_SKILLS = 250;
const MAX_DEPTH = 14;
const MAX_CONTENT = 24000;
const SKILL_TAG = "codex-skill";

export interface DiscoveredSkill {
  key: string;
  name: string;
  description: string;
  content: string;
  filePath: string;
  modifiedAt: string;
  tags: string[];
}

function cleanFrontmatterValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function humanize(value: string) {
  const title = value
    .replace(/^.*:/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return title.replace(/\b(Api|Ai|Pdf|Rpg|Seo|Ui|Url|Youtube)\b/g, (word) => ({
    Api: "API", Ai: "AI", Pdf: "PDF", Rpg: "RPG", Seo: "SEO", Ui: "UI", Url: "URL", Youtube: "YouTube",
  })[word] || word);
}

function parseSkill(raw: string, filePath: string, modifiedAt: Date): DiscoveredSkill {
  const frontmatter = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  const metadata = new Map<string, string>();
  for (const line of (frontmatter?.[1] || "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0) metadata.set(line.slice(0, separator).trim(), cleanFrontmatterValue(line.slice(separator + 1)));
  }
  const fallback = path.basename(path.dirname(filePath));
  const name = metadata.get("name") || fallback;
  const description = metadata.get("description") || `Operational knowledge for ${humanize(name)}.`;
  const body = raw.slice(frontmatter?.[0].length || 0).trim();
  const content = [
    `Capability: ${description}`,
    body ? `Operational knowledge:\n\n${body}` : "",
  ].filter(Boolean).join("\n\n").slice(0, MAX_CONTENT);
  const keywords = `${name} ${description}`.toLowerCase();
  const tags = [SKILL_TAG, "skill", "capability"];
  for (const candidate of ["roblox", "coding", "browser", "youtube", "video", "documents", "spreadsheets", "presentations", "design", "research", "automation", "image", "pdf"]) {
    if (keywords.includes(candidate)) tags.push(candidate);
  }
  return {
    key: name.toLowerCase(),
    name,
    description,
    content,
    filePath,
    modifiedAt: modifiedAt.toISOString(),
    tags: [...new Set(tags)],
  };
}

async function collectSkillFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (files.length >= MAX_SKILLS) break;
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === "skill.md") files.push(entryPath);
    else if (entry.isDirectory() && !["node_modules", ".git"].includes(entry.name)) files.push(...await collectSkillFiles(entryPath, depth + 1));
  }
  return files.slice(0, MAX_SKILLS);
}

function configuredRoots() {
  const custom = process.env.BLACKHOLE_SKILL_ROOTS?.split(path.delimiter).map((item) => item.trim()).filter(Boolean) || [];
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return [...new Set([
    ...custom,
    path.join(codexHome, "skills"),
    path.join(codexHome, "plugins", "cache"),
  ])];
}

export async function discoverSkills() {
  const allFiles = (await Promise.all(configuredRoots().map((root) => collectSkillFiles(root)))).flat();
  const discovered = new Map<string, DiscoveredSkill>();
  for (const filePath of allFiles) {
    try {
      const [raw, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
      const skill = parseSkill(raw, filePath, stat.mtime);
      const previous = discovered.get(skill.key);
      if (!previous || skill.modifiedAt > previous.modifiedAt) discovered.set(skill.key, skill);
    } catch {
      // A single unreadable optional skill should not stop the rest of the library.
    }
  }
  return [...discovered.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function sourceUrl(skill: DiscoveredSkill) {
  return `codex-skill://library/${encodeURIComponent(skill.key)}`;
}

function skillTitle(skill: DiscoveredSkill) {
  return `Skill · ${humanize(skill.name)}`;
}

function skillEmbeddingText(skill: DiscoveredSkill) {
  return `${skillTitle(skill)}\n${skill.description}\n${skill.tags.join(" ")}`;
}

function connectSkill(memory: Memory, memories: Memory[], connections: Connection[], timestamp: string) {
  const current = memory.embedding || localEmbedding(`${memory.title} ${memory.content}`);
  const candidates = memories
    .filter((candidate) => candidate.id !== memory.id && !candidate.archived)
    .map((candidate) => ({
      candidate,
      score: cosineSimilarity(current, candidate.embedding || localEmbedding(`${candidate.title} ${candidate.content}`)),
    }))
    .filter(({ score }) => score >= 0.3)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
  for (const { candidate, score } of candidates) {
    connections.push({
      id: randomUUID(),
      sourceId: memory.id,
      targetId: candidate.id,
      type: memory.projectId && memory.projectId === candidate.projectId ? "belongs_to_project" : "related_to",
      score,
      automatic: true,
      createdAt: timestamp,
    });
  }
}

export async function syncSkills() {
  const discovered = await discoverSkills();
  const store = await readStore();
  const existing = new Map(store.memories.filter((memory) => memory.tags.includes(SKILL_TAG) && memory.sourceUrl).map((memory) => [memory.sourceUrl, memory]));
  const changed = discovered.filter((skill) => {
    const memory = existing.get(sourceUrl(skill));
    return !memory || memory.content !== skill.content || memory.title !== skillTitle(skill);
  });
  const embeddings = await createEmbeddings(changed.map(skillEmbeddingText));
  const timestamp = new Date().toISOString();
  let added = 0;
  let updated = 0;
  const changedMemories: Memory[] = [];

  changed.forEach((skill, index) => {
    const url = sourceUrl(skill);
    const previous = existing.get(url);
    const robloxProject = skill.tags.includes("roblox") ? store.projects.find((project) => project.id === "project-roblox" || project.name.toLowerCase().includes("roblox")) : undefined;
    const memory: Memory = {
      id: previous?.id || randomUUID(),
      title: skillTitle(skill),
      content: skill.content,
      category: "document",
      tags: skill.tags,
      source: "Codex skill library",
      sourceUrl: url,
      projectId: robloxProject?.id,
      archived: false,
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp,
      embedding: embeddings[index] || localEmbedding(skillEmbeddingText(skill)),
    };
    if (previous) {
      store.memories[store.memories.findIndex((item) => item.id === previous.id)] = memory;
      updated += 1;
    } else {
      store.memories.unshift(memory);
      added += 1;
    }
    changedMemories.push(memory);
  });

  if (changedMemories.length) {
    const changedIds = new Set(changedMemories.map((memory) => memory.id));
    store.connections = store.connections.filter((connection) => !connection.automatic || (!changedIds.has(connection.sourceId) && !changedIds.has(connection.targetId)));
    for (const memory of changedMemories) connectSkill(memory, store.memories, store.connections, timestamp);
    await writeStore(store);
  }

  return { discovered: discovered.length, added, updated, unchanged: discovered.length - changed.length, syncedAt: timestamp };
}

export async function listSkillMemories() {
  const store = await readStore();
  return store.memories
    .filter((memory) => memory.tags.includes("skill") && !memory.archived)
    .sort((left, right) => left.title.localeCompare(right.title))
    .map(withoutEmbedding);
}
