import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cosineSimilarity, createEmbeddings, localEmbedding } from "@/lib/semantic";
import { readStore, writeStore, withoutEmbedding } from "@/lib/store";
import type { Connection, Memory } from "@/lib/types";

const MAX_SKILLS = 300;
const MAX_DOCUMENTS = 1600;
const MAX_DEPTH = 16;
const MAX_CONTENT = 24000;
const SKILL_TAG = "codex-skill";
const VAULT_TAG = "obsidian-vault";

export type KnowledgeKind = "skill" | "skill-reference" | "vault-note";

export interface DiscoveredSkill {
  key: string;
  name: string;
  title: string;
  description: string;
  content: string;
  filePath: string;
  sourceUrl: string;
  modifiedAt: string;
  tags: string[];
  kind: KnowledgeKind;
  wikilinks: string[];
}

function cleanFrontmatterValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function frontmatter(raw: string) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  const metadata = new Map<string, string>();
  for (const line of (match?.[1] || "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0) metadata.set(line.slice(0, separator).trim(), cleanFrontmatterValue(line.slice(separator + 1)));
  }
  return { metadata, body: raw.slice(match?.[0].length || 0).trim() };
}

function humanize(value: string) {
  const title = value.replace(/^.*:/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return title.replace(/\b(Api|Ai|Pdf|Rpg|Seo|Ui|Ux|Url|Vfx|Youtube)\b/g, (word) => ({
    Api: "API", Ai: "AI", Pdf: "PDF", Rpg: "RPG", Seo: "SEO", Ui: "UI", Ux: "UX", Url: "URL", Vfx: "VFX", Youtube: "YouTube",
  })[word] || word);
}

function inferTags(text: string, base: string[]) {
  const tags = [...base];
  const keywords = text.toLowerCase();
  for (const candidate of ["roblox", "luau", "coding", "architecture", "security", "networking", "data", "economy", "combat", "animation", "rigging", "blender", "3d", "vfx", "lighting", "ui", "ux", "audio", "camera", "performance", "testing", "liveops", "browser", "youtube", "video", "documents", "spreadsheets", "presentations", "design", "research", "automation", "image", "pdf"]) {
    if (keywords.includes(candidate)) tags.push(candidate);
  }
  return [...new Set(tags)];
}

function extractWikilinks(raw: string) {
  return [...new Set([...raw.matchAll(/\[\[([^\]|#^]+)(?:#[^\]|^]+)?(?:\|[^\]]+)?\]\]/g)].map((match) => match[1].trim()).filter(Boolean))];
}

function firstDescription(body: string, fallback: string) {
  const paragraph = body.split(/\r?\n\r?\n/).map((part) => part.replace(/^#+\s+.*$/gm, "").replace(/^>\s*\[!.*?\].*$/gm, "").replace(/^>\s?/gm, "").trim()).find((part) => part && !part.startsWith("```") && !part.startsWith("|"));
  return (paragraph || fallback).replace(/\s+/g, " ").slice(0, 280);
}

function parseSkill(raw: string, filePath: string, modifiedAt: Date): DiscoveredSkill {
  const parsed = frontmatter(raw);
  const fallback = path.basename(path.dirname(filePath));
  const name = parsed.metadata.get("name") || fallback;
  const description = parsed.metadata.get("description") || `Operational knowledge for ${humanize(name)}.`;
  const content = [`Capability: ${description}`, parsed.body ? `Operational knowledge:\n\n${parsed.body}` : ""].filter(Boolean).join("\n\n").slice(0, MAX_CONTENT);
  return {
    key: name.toLowerCase(), name, title: `Skill · ${humanize(name)}`, description, content, filePath,
    sourceUrl: `codex-skill://library/${encodeURIComponent(name.toLowerCase())}`,
    modifiedAt: modifiedAt.toISOString(), kind: "skill", wikilinks: extractWikilinks(raw),
    tags: inferTags(`${name} ${description} ${content}`, [SKILL_TAG, "skill", "capability"]),
  };
}

function parseSkillReference(raw: string, filePath: string, modifiedAt: Date, skill: DiscoveredSkill): DiscoveredSkill {
  const parsed = frontmatter(raw);
  const heading = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim() || humanize(path.basename(filePath, path.extname(filePath)));
  const relative = path.relative(path.dirname(skill.filePath), filePath).replaceAll(path.sep, "/");
  const key = `${skill.key}/reference/${relative.toLowerCase()}`;
  return {
    key, name: heading, title: `Reference · ${humanize(skill.name)} · ${heading}`,
    description: firstDescription(parsed.body, `Implementation reference for ${humanize(skill.name)}.`),
    content: parsed.body.slice(0, MAX_CONTENT), filePath,
    sourceUrl: `codex-skill://library/${encodeURIComponent(skill.key)}/reference/${encodeURIComponent(relative)}`,
    modifiedAt: modifiedAt.toISOString(), kind: "skill-reference", wikilinks: extractWikilinks(raw),
    tags: inferTags(`${skill.name} ${heading} ${parsed.body}`, [SKILL_TAG, "skill", "skill-reference", "implementation"]),
  };
}

function parseVaultNote(raw: string, filePath: string, root: string, modifiedAt: Date): DiscoveredSkill {
  const parsed = frontmatter(raw);
  const name = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath, path.extname(filePath));
  const relative = path.relative(root, filePath).replaceAll(path.sep, "/");
  const frontmatterTags = (parsed.metadata.get("tags") || "").replace(/[\[\]]/g, "").split(",").map((tag) => tag.trim()).filter(Boolean);
  return {
    key: `vault/${relative.toLowerCase()}`, name, title: `Vault · ${name}`,
    description: firstDescription(parsed.body, `Obsidian knowledge note: ${name}.`), content: parsed.body.slice(0, MAX_CONTENT), filePath,
    sourceUrl: `obsidian-vault://roblox-developer-mastery/${encodeURIComponent(relative)}`,
    modifiedAt: modifiedAt.toISOString(), kind: "vault-note", wikilinks: extractWikilinks(raw),
    tags: inferTags(`${relative} ${name} ${parsed.body}`, [VAULT_TAG, "obsidian-note", ...frontmatterTags]),
  };
}

async function collectFiles(root: string, predicate: (name: string) => boolean, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return []; }
  const files: string[] = [];
  for (const entry of entries) {
    if (files.length >= MAX_DOCUMENTS) break;
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && predicate(entry.name)) files.push(entryPath);
    else if (entry.isDirectory() && !["node_modules", ".git", ".obsidian", ".vaultcraft", ".trash", "Assets"].includes(entry.name)) files.push(...await collectFiles(entryPath, predicate, depth + 1));
  }
  return files.slice(0, MAX_DOCUMENTS);
}

function configuredSkillRoots() {
  const custom = process.env.BLACKHOLE_SKILL_ROOTS?.split(path.delimiter).map((item) => item.trim()).filter(Boolean) || [];
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return [...new Set([...custom, path.join(codexHome, "skills"), path.join(codexHome, "plugins", "cache")])];
}

function configuredVaultRoots() {
  const custom = process.env.BLACKHOLE_VAULT_ROOTS?.split(path.delimiter).map((item) => item.trim()).filter(Boolean) || [];
  return [...new Set([...custom, path.join(os.homedir(), "Documents", "ObsidianVaults", "Roblox Developer Mastery")])];
}

export async function discoverSkills() {
  const allFiles = (await Promise.all(configuredSkillRoots().map((root) => collectFiles(root, (name) => name.toLowerCase() === "skill.md")))).flat().slice(0, MAX_SKILLS);
  const discovered = new Map<string, DiscoveredSkill>();
  for (const filePath of allFiles) {
    try {
      const [raw, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
      const skill = parseSkill(raw, filePath, stat.mtime);
      const previous = discovered.get(skill.key);
      if (!previous || skill.modifiedAt > previous.modifiedAt) discovered.set(skill.key, skill);
    } catch { /* One unreadable optional skill must not stop discovery. */ }
  }
  return [...discovered.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function discoverKnowledge() {
  const skills = await discoverSkills();
  const references: DiscoveredSkill[] = [];
  for (const skill of skills) {
    const referenceRoot = path.join(path.dirname(skill.filePath), "references");
    for (const filePath of await collectFiles(referenceRoot, (name) => name.toLowerCase().endsWith(".md"))) {
      try {
        const [raw, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
        references.push(parseSkillReference(raw, filePath, stat.mtime, skill));
      } catch { /* Keep the rest of the local library available. */ }
    }
  }
  const vaultNotes: DiscoveredSkill[] = [];
  for (const root of configuredVaultRoots()) {
    for (const filePath of await collectFiles(root, (name) => name.toLowerCase().endsWith(".md"))) {
      try {
        const [raw, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
        vaultNotes.push(parseVaultNote(raw, filePath, root, stat.mtime));
      } catch { /* Keep the rest of the vault available. */ }
    }
  }
  return [...skills, ...references, ...vaultNotes];
}

export async function discoverySummary() {
  const knowledge = await discoverKnowledge();
  return {
    total: knowledge.length,
    skills: knowledge.filter((item) => item.kind === "skill").length,
    references: knowledge.filter((item) => item.kind === "skill-reference").length,
    vaultNotes: knowledge.filter((item) => item.kind === "vault-note").length,
  };
}

function embeddingText(item: DiscoveredSkill) {
  return `${item.title}\n${item.description}\n${item.tags.join(" ")}`;
}

function hasConnection(connections: Connection[], sourceId: string, targetId: string) {
  return connections.some((connection) => (connection.sourceId === sourceId && connection.targetId === targetId) || (connection.sourceId === targetId && connection.targetId === sourceId));
}

function connectSemantic(memory: Memory, memories: Memory[], connections: Connection[], timestamp: string) {
  const current = memory.embedding || localEmbedding(`${memory.title} ${memory.content}`);
  const candidates = memories.filter((candidate) => candidate.id !== memory.id && !candidate.archived).map((candidate) => ({
    candidate, score: cosineSimilarity(current, candidate.embedding || localEmbedding(`${candidate.title} ${candidate.content}`)),
  })).filter(({ score }) => score >= 0.3).sort((left, right) => right.score - left.score).slice(0, 4);
  for (const { candidate, score } of candidates) {
    if (hasConnection(connections, memory.id, candidate.id)) continue;
    connections.push({ id: randomUUID(), sourceId: memory.id, targetId: candidate.id, type: memory.projectId && memory.projectId === candidate.projectId ? "belongs_to_project" : "related_to", score, automatic: true, createdAt: timestamp });
  }
}

export async function syncSkills() {
  const discovered = await discoverKnowledge();
  const store = await readStore();
  const managed = store.memories.filter((memory) => (memory.tags.includes(SKILL_TAG) || memory.tags.includes(VAULT_TAG)) && memory.sourceUrl);
  const existing = new Map(managed.map((memory) => [memory.sourceUrl!, memory]));
  const currentUrls = new Set(discovered.map((item) => item.sourceUrl));
  const stale = managed.filter((memory) => !currentUrls.has(memory.sourceUrl!));
  const changed = discovered.filter((item) => {
    const memory = existing.get(item.sourceUrl);
    return !memory || memory.content !== item.content || memory.title !== item.title || memory.tags.join("|") !== item.tags.join("|");
  });
  const embeddings = await createEmbeddings(changed.map(embeddingText));
  const timestamp = new Date().toISOString();
  let added = 0;
  let updated = 0;

  if (stale.length) {
    const staleIds = new Set(stale.map((memory) => memory.id));
    store.memories = store.memories.filter((memory) => !staleIds.has(memory.id));
    store.connections = store.connections.filter((connection) => !staleIds.has(connection.sourceId) && !staleIds.has(connection.targetId));
  }

  changed.forEach((item, index) => {
    const previous = existing.get(item.sourceUrl);
    const robloxProject = item.tags.includes("roblox") ? store.projects.find((project) => project.id === "project-roblox" || project.name.toLowerCase().includes("roblox")) : undefined;
    const memory: Memory = {
      id: previous?.id || randomUUID(), title: item.title, content: item.content, category: "document", tags: item.tags,
      source: item.kind === "vault-note" ? "Obsidian · Roblox Developer Mastery" : item.kind === "skill-reference" ? "Codex skill reference" : "Codex skill library",
      sourceUrl: item.sourceUrl, projectId: robloxProject?.id, archived: false,
      createdAt: previous?.createdAt || timestamp, updatedAt: timestamp,
      embedding: embeddings[index] || localEmbedding(embeddingText(item)),
    };
    if (previous) {
      const previousIndex = store.memories.findIndex((candidate) => candidate.id === previous.id);
      if (previousIndex >= 0) store.memories[previousIndex] = memory;
      updated += 1;
    } else {
      store.memories.unshift(memory);
      added += 1;
    }
  });

  if (changed.length || stale.length) {
    const managedIds = new Set(store.memories.filter((memory) => memory.tags.includes(SKILL_TAG) || memory.tags.includes(VAULT_TAG)).map((memory) => memory.id));
    store.connections = store.connections.filter((connection) => !connection.automatic || (!managedIds.has(connection.sourceId) && !managedIds.has(connection.targetId)));
    const memoryByUrl = new Map(store.memories.filter((memory) => memory.sourceUrl).map((memory) => [memory.sourceUrl!, memory]));
    const vaultByName = new Map(discovered.filter((item) => item.kind === "vault-note").map((item) => [item.name.toLowerCase(), memoryByUrl.get(item.sourceUrl)]));
    for (const item of discovered) {
      const memory = memoryByUrl.get(item.sourceUrl);
      if (!memory) continue;
      for (const link of item.wikilinks) {
        const target = vaultByName.get(link.toLowerCase());
        if (!target || target.id === memory.id || hasConnection(store.connections, memory.id, target.id)) continue;
        store.connections.push({ id: randomUUID(), sourceId: memory.id, targetId: target.id, type: "related_to", score: 1, automatic: true, createdAt: timestamp });
      }
      connectSemantic(memory, store.memories, store.connections, timestamp);
    }
    await writeStore(store);
  }

  const counts = { skills: discovered.filter((item) => item.kind === "skill").length, references: discovered.filter((item) => item.kind === "skill-reference").length, vaultNotes: discovered.filter((item) => item.kind === "vault-note").length };
  return { discovered: discovered.length, ...counts, added, updated, removed: stale.length, unchanged: discovered.length - changed.length, syncedAt: timestamp };
}

export async function listSkillMemories() {
  const store = await readStore();
  return store.memories.filter((memory) => (memory.tags.includes(SKILL_TAG) || memory.tags.includes(VAULT_TAG)) && !memory.archived).sort((left, right) => left.title.localeCompare(right.title)).map(withoutEmbedding);
}
