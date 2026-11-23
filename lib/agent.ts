import { randomUUID } from "node:crypto";
import {
  cosineSimilarity,
  localEmbedding,
  type RankedMemoryChunk,
} from "@/lib/semantic";
import { isSkillMemory } from "@/lib/skill-activity";
import type {
  ActionProposal,
  AgentEvidence,
  AgentAppliedLesson,
  AgentAppliedPlaybook,
  AgentPlaybook,
  AgentOutcome,
  AgentRun,
  LearningRecord,
  Memory,
  RobloxProProfile,
  RobloxSpecialistLane,
  SkillScore,
} from "@/lib/types";

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

interface RobloxLaneDefinition {
  id: string;
  title: string;
  skillSlug: string;
  role: string;
  patterns: RegExp;
  core?: boolean;
}

const ROBLOX_LANES: RobloxLaneDefinition[] = [
  {
    id: "game-direction",
    title: "Game direction & combat",
    skillSlug: "roblox-action-rpg-dev",
    role: "Own the playable loop, combat grammar, enemies, bosses, progression, and vertical-slice scope.",
    patterns: /combat|boss|enemy|ability|power|rpg|gameplay|vertical slice|progression|class|weapon/i,
    core: true,
  },
  {
    id: "architecture",
    title: "Typed Luau architecture",
    skillSlug: "roblox-luau-architecture",
    role: "Define strict contracts, client-server-shared boundaries, state machines, lifecycle, and cleanup.",
    patterns: /code|script|luau|module|service|controller|architecture|refactor|state machine|system/i,
    core: true,
  },
  {
    id: "security",
    title: "Networking & security",
    skillSlug: "roblox-networking-security",
    role: "Keep the server authoritative and validate, rate-limit, reconcile, and audit every client request.",
    patterns: /remote|network|multiplayer|security|exploit|server|client|replication|physics|trade/i,
    core: true,
  },
  {
    id: "qa",
    title: "QA, performance & LiveOps",
    skillSlug: "roblox-qa-liveops",
    role: "Set acceptance criteria, test multiplayer failure paths, profile budgets, and own release and rollback gates.",
    patterns: /test|qa|bug|performance|profile|optimi[sz]|release|publish|liveops|latency|memory|fps/i,
    core: true,
  },
  {
    id: "ui",
    title: "UI & cross-platform UX",
    skillSlug: "roblox-ui-ux",
    role: "Design responsive HUDs and flows with touch, keyboard, gamepad, safe-area, focus, and failure-state parity.",
    patterns: /\b(ui|ux|hud|menu|inventory|shop|dialog|onboarding|button|interface|mobile|gamepad)\b/i,
  },
  {
    id: "vfx",
    title: "VFX & lighting",
    skillSlug: "roblox-vfx-lighting",
    role: "Make telegraphs readable before adding spectacle, with explicit effect budgets and low-effects fallbacks.",
    patterns: /vfx|effect|particle|beam|trail|lighting|telegraph|impact|aura|weather|camera shake/i,
  },
  {
    id: "animation",
    title: "Animation & rigging",
    skillSlug: "roblox-animation-rigging",
    role: "Own rigs, key poses, markers, blending, interruption, deformation, and animation-driven presentation.",
    patterns: /animat|rig|skin|bone|ik|locomotion|marker|blend|creature|character/i,
  },
  {
    id: "assets",
    title: "3D asset pipeline",
    skillSlug: "roblox-3d-asset-pipeline",
    role: "Take gameplay assets through scale, topology, UVs, PBR, collision, export, import, and device-budget QA.",
    patterns: /3d|model|mesh|blender|topology|uv|texture|pbr|asset|prop|environment art/i,
  },
  {
    id: "economy",
    title: "Items & economy",
    skillSlug: "roblox-items-economy",
    role: "Model server-owned, replay-safe item and currency transactions with fair sources, sinks, and persistence.",
    patterns: /item|economy|inventory|loot|drop|craft|currency|shop|purchase|moneti[sz]|equipment|reward/i,
  },
  {
    id: "world",
    title: "World, audio & camera",
    skillSlug: "roblox-world-audio-camera",
    role: "Build streaming-safe spaces, traversal, modular environments, audio states, cameras, and encounter staging.",
    patterns: /world|map|level|terrain|audio|sound|music|camera|cutscene|streaming|traversal|region/i,
  },
  {
    id: "narrative",
    title: "Narrative & quests",
    skillSlug: "roblox-narrative-quests",
    role: "Create versioned quest and dialogue state machines with authoritative transitions and idempotent rewards.",
    patterns: /quest|story|narrative|dialogue|dialog|objective|npc|cutscene|branch/i,
  },
  {
    id: "analytics",
    title: "Analytics & experiments",
    skillSlug: "roblox-analytics-experiments",
    role: "Instrument decisions with bounded event schemas, funnels, guardrails, experiments, and rollback triggers.",
    patterns: /analytics|metric|telemetry|retention|funnel|experiment|ab test|kpi|drop.off/i,
  },
  {
    id: "accessibility",
    title: "Accessibility & localization",
    skillSlug: "roblox-accessibility-localization",
    role: "Keep critical journeys operable across language, input, screen size, color, sound, motion, and text scale.",
    patterns: /accessib|locali[sz]|translate|subtitle|contrast|reduced motion|colorblind|text scale/i,
  },
  {
    id: "studio-tooling",
    title: "Studio tooling",
    skillSlug: "roblox-studio-tooling",
    role: "Build reversible, undo-aware Studio workflows with previews, validation, bounded writes, and safe automation.",
    patterns: /studio|plugin|editor|tooling|automation|selection|dock widget|changehistory/i,
  },
];

const BROAD_ROBLOX_GOAL = /full game|complete game|entire game|vertical slice|production plan|game dev pro|professional|from scratch|ship the game/i;

export function isRobloxSignal(signal: string) {
  return /\broblox\b/i.test(signal);
}

function findSkillForLane(lane: RobloxLaneDefinition, skills: Memory[]) {
  const slug = lane.skillSlug.toLowerCase();
  const titleNeedle = slug.replace(/^roblox-/, "").replace(/-/g, " ");
  return skills.find((memory) => {
    const source = memory.source.toLowerCase().replace(/\\/g, "/");
    const title = memory.title.toLowerCase();
    return source.includes(slug) || title.includes(titleNeedle);
  });
}

export function routeRobloxSpecialists(signal: string, skills: Memory[]): RobloxSpecialistLane[] {
  const broad = BROAD_ROBLOX_GOAL.test(signal);
  return ROBLOX_LANES.filter(
    (lane) => lane.core || broad || lane.patterns.test(signal),
  ).map((lane) => {
    const skill = findSkillForLane(lane, skills);
    return {
      id: lane.id,
      title: lane.title,
      skillSlug: lane.skillSlug,
      skillId: skill?.id,
      role: lane.role,
      reason: lane.core
        ? "Required production guardrail for every Roblox change."
        : broad
          ? "Activated because this objective spans the full production pipeline."
          : "Activated from the objective's craft and system requirements.",
      required: Boolean(lane.core),
    };
  });
}

export function getRobloxProReadiness(skills: Memory[]) {
  const installed = ROBLOX_LANES.filter((lane) => findSkillForLane(lane, skills));
  return {
    installed: installed.length,
    total: ROBLOX_LANES.length,
    ready: installed.length === ROBLOX_LANES.length,
    missing: ROBLOX_LANES.filter((lane) => !findSkillForLane(lane, skills)).map(
      (lane) => lane.title,
    ),
  };
}

export function buildRobloxProProfile(
  signal: string,
  skills: Memory[],
): RobloxProProfile | undefined {
  if (!isRobloxSignal(signal)) return undefined;
  const specialistLanes = routeRobloxSpecialists(signal, skills);
  return {
    mode: "roblox_game_dev_pro",
    title: "Roblox Game Dev Pro",
    summary: "A production-minded Roblox lead that coordinates design, typed Luau, server authority, content, cross-platform UX, profiling, and release safety.",
    experiencePillars: [
      "Every dangerous action is readable early enough for a player to respond.",
      "The server owns damage, rewards, inventory, progression, and every durable outcome.",
      "The core loop remains understandable and responsive on phone, desktop, and gamepad.",
      "Performance, accessibility, failure recovery, and observability are designed in before release.",
    ],
    specialistLanes,
    ownershipRules: [
      "Client: input sampling, camera, local UI, cosmetic anticipation, audio, animation blending, and bounded VFX.",
      "Server: legality, damage, NPC decisions, cooldowns, inventory, currency, quests, rewards, and saved data.",
      "Shared: strict immutable definitions, payload types, state contracts, and deterministic calculations only.",
    ],
    implementationOrder: [
      "Inspect the existing place, hierarchy, code conventions, dependencies, and current playable loop.",
      "Lock the feature contract: player value, authority, state, failure modes, budgets, and acceptance criteria.",
      "Build one end-to-end path: input → validated server transition → confirmed outcome → client presentation.",
      "Add content breadth only after the first path works in a server with at least two clients.",
      "Test touch, gamepad, latency, packet loss, respawn, reconnect, streaming, and save failure.",
      "Profile the worst representative encounter, fix the largest measured bottleneck, and rerun the capture.",
      "Release behind an appropriate flag or staged rollout with telemetry and a written rollback path.",
    ],
    acceptanceCriteria: [
      "The feature has explicit success, rejection, empty, loading, interruption, and cleanup behavior.",
      "Every client request has a typed bounded payload, permission/state validation, and per-player rate limits.",
      "Keyboard/mouse, touch, and gamepad can complete the critical journey without hidden device-specific blockers.",
      "Combat tells and critical UI remain legible during a full-party encounter and in low-effects mode.",
      "Connections, tasks, animations, temporary instances, and player-indexed state clean up deterministically.",
      "Measured client/server cost stays inside the agreed target-device budget.",
    ],
    verificationGates: [
      "Unit tests for pure calculations and guarded state transitions.",
      "Solo feel test, then one-server/two-client replication and race-condition test.",
      "Adverse-network, exploit-payload, respawn, reconnect, shutdown, and persistence-failure tests.",
      "Fresh-player phone, desktop, and gamepad playtest with no coaching.",
      "Developer Console and MicroProfiler evidence from the worst realistic encounter.",
    ],
    releaseBlockers: [
      "Client-authoritative damage, rewards, prices, inventory, quest completion, or purchases.",
      "Duplicate grants, unrecoverable data loss, quest/cutscene soft locks, or broken reconnect/respawn.",
      "Unreadable combat-critical feedback or missing touch/gamepad completion paths.",
      "Unmeasured or materially failing performance on representative target devices.",
    ],
  };
}

export function filterSkillPool(signal: string, skills: Memory[]) {
  if (!isRobloxSignal(signal)) return skills;
  return skills.filter(
    (memory) =>
      /\broblox\b/i.test(memory.title) ||
      /roblox-/i.test(memory.source) ||
      memory.tags.includes("roblox"),
  );
}

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((word) => !["the", "and", "for", "with", "that"].includes(word)) || [],
  );
}

export function rankLearningRecords(
  goal: string,
  records: LearningRecord[],
  projectId?: string,
  limit = 3,
): AgentAppliedLesson[] {
  const queryWords = words(goal);
  const queryVector = localEmbedding(goal);
  return records
    .filter((record) => !projectId || record.projectId === projectId)
    .map((record) => {
      const text = `${record.title} ${record.lesson} ${record.feedback || ""}`;
      const recordWords = words(text);
      const hits = [...queryWords].filter((word) => recordWords.has(word)).length;
      const lexical = queryWords.size ? hits / queryWords.size : 0;
      const semantic = cosineSimilarity(queryVector, localEmbedding(text));
      const outcomeWeight =
        record.outcome === "success"
          ? 0.08
          : record.outcome === "failed"
            ? 0.04
            : record.outcome === "partial"
              ? 0.05
              : 0;
      return {
        id: record.id,
        title: record.title,
        lesson: record.feedback
          ? `${record.lesson} Correction: ${record.feedback}`
          : record.lesson,
        outcome: record.outcome,
        confidence: record.confidence,
        relevance: Number(
          (semantic * 0.55 + lexical * 0.3 + record.confidence * 0.15 + outcomeWeight).toFixed(3),
        ),
      };
    })
    .filter((record) => record.relevance >= 0.18)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);
}

export function rankPlaybooks(
  goal: string,
  playbooks: AgentPlaybook[],
  projectId?: string,
  limit = 2,
): AgentAppliedPlaybook[] {
  const goalVector = localEmbedding(goal);
  const goalWords = words(goal);
  return playbooks
    .filter((playbook) => !projectId || playbook.projectId === projectId)
    .map((playbook) => {
      const text = `${playbook.name} ${playbook.description} ${playbook.trigger} ${playbook.steps.join(" ")}`;
      const playbookWords = words(text);
      const hits = [...goalWords].filter((word) => playbookWords.has(word)).length;
      const lexical = goalWords.size ? hits / goalWords.size : 0;
      const relevance = Number(
        (
          cosineSimilarity(goalVector, localEmbedding(text)) * 0.62 +
          lexical * 0.25 +
          playbook.confidence * 0.13
        ).toFixed(3),
      );
      return { ...playbook, relevance };
    })
    .filter((playbook) => playbook.relevance >= 0.22)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);
}

export function createPlaybookFromRun(
  run: AgentRun,
  name?: string,
  timestamp = new Date().toISOString(),
): AgentPlaybook {
  if (run.status !== "completed" || run.outcome === "unrated" || run.outcome === "failed")
    throw new Error("Only successful or partially successful completed runs can become playbooks.");
  return {
    id: randomUUID(),
    name:
      name?.trim() ||
      (run.goal.length > 72 ? `${run.goal.slice(0, 69)}…` : run.goal),
    description: `Reusable workflow learned from a ${run.outcome} agent run.`,
    trigger: run.goal,
    projectId: run.projectId,
    steps: run.steps
      .filter((step) => ["recall", "skills", "act", "verify"].includes(step.kind))
      .map((step) => `${step.title}: ${step.description}`),
    skillIds: run.skillIds,
    sourceRunId: run.id,
    confidence: run.outcome === "success" ? 0.78 : 0.62,
    usageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function rerankSkillsWithExperience(
  ranked: RankedMemoryChunk[],
  scores: SkillScore[],
) {
  const byId = new Map(scores.map((score) => [score.skillId, score]));
  return ranked
    .map((item) => {
      const experience = byId.get(item.memory.id);
      if (!experience) return item;
      const evidenceWeight = Math.min(1, experience.uses / 5);
      const multiplier = 1 + (experience.score - 0.5) * 0.35 * evidenceWeight;
      return { ...item, score: item.score * multiplier };
    })
    .sort((left, right) => right.score - left.score);
}

export function buildAgentRun({
  goal,
  projectId,
  ranked,
  proposedAction,
  lessons = [],
  playbooks = [],
  robloxProfile,
  id = randomUUID(),
  timestamp = new Date().toISOString(),
}: {
  goal: string;
  projectId?: string;
  ranked: RankedMemoryChunk[];
  proposedAction?: ActionProposal;
  lessons?: AgentAppliedLesson[];
  playbooks?: AgentAppliedPlaybook[];
  robloxProfile?: RobloxProProfile;
  id?: string;
  timestamp?: string;
}): AgentRun {
  const evidence: AgentEvidence[] = ranked.slice(0, 6).map((item) => ({
    memoryId: item.memory.id,
    title: item.memory.title,
    heading: item.heading,
    excerpt: item.content.slice(0, 260),
    score: Number(item.score.toFixed(3)),
  }));
  const skillIds = unique([
    ...(robloxProfile?.specialistLanes.flatMap((lane) =>
      lane.skillId ? [lane.skillId] : [],
    ) || []),
    ...ranked
      .filter(({ memory }) => isSkillMemory(memory))
      .map(({ memory }) => memory.id),
  ]).slice(0, 14);
  const actionDescription = proposedAction
    ? proposedAction.description
    : "Produce a grounded response from the selected project knowledge. No external systems will be changed.";
  return {
    id,
    goal,
    projectId,
    status: "awaiting_approval",
    skillIds,
    evidence,
    appliedLessons: lessons,
    appliedPlaybooks: playbooks,
    robloxProfile,
    proposedAction,
    outcome: "unrated",
    steps: [
      {
        id: `${id}-understand`,
        kind: "understand",
        title: "Understand the objective",
        description: "Attach the request to the active project and identify intent.",
        status: "completed",
      },
      {
        id: `${id}-recall`,
        kind: "recall",
        title: "Recall verified context",
        description: `${evidence.length} relevant knowledge source${evidence.length === 1 ? "" : "s"} and ${lessons.length} prior lesson${lessons.length === 1 ? "" : "s"} found.`,
        status: "completed",
      },
      {
        id: `${id}-skills`,
        kind: "skills",
        title: robloxProfile ? "Assemble the Roblox production team" : "Activate the skill stack",
        description: robloxProfile
          ? `${robloxProfile.specialistLanes.length} coordinated specialist lane${robloxProfile.specialistLanes.length === 1 ? "" : "s"} will cover design, implementation, safety, presentation, and verification.`
          : `${skillIds.length} matching skill${skillIds.length === 1 ? "" : "s"} and ${playbooks.length} reusable playbook${playbooks.length === 1 ? "" : "s"} will guide the run.`,
        status: "pending",
      },
      {
        id: `${id}-act`,
        kind: "act",
        title: proposedAction ? proposedAction.title : "Synthesize the next move",
        description: actionDescription,
        status: "pending",
        requiresApproval: true,
      },
      {
        id: `${id}-verify`,
        kind: "verify",
        title: "Verify the result",
        description: "Check the completed work against its evidence and expected result.",
        status: "pending",
      },
      {
        id: `${id}-learn`,
        kind: "learn",
        title: "Capture the lesson",
        description: "Store the outcome and improve future skill recommendations.",
        status: "pending",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildGroundedAgentResult(
  run: AgentRun,
  actionSummary?: string,
) {
  if (actionSummary) return actionSummary;
  if (run.robloxProfile) {
    const profile = run.robloxProfile;
    const laneLines = profile.specialistLanes.map(
      (lane) => `- **${lane.title}:** ${lane.role}`,
    );
    const evidenceLines = run.evidence.slice(0, 6).map(
      (item, index) =>
        `${index + 1}. **${item.title.replace(/^(Skill|Reference|Vault) · /, "")} — ${item.heading}:** ${item.excerpt}`,
    );
    const priorLessons = (run.appliedLessons || []).map(
      (item) => `- ${item.outcome === "failed" ? "Avoid repeating" : "Reuse"}: ${item.lesson}`,
    );
    const playbookSteps = (run.appliedPlaybooks || []).flatMap((playbook) => [
      `- **${playbook.name}** (${Math.round(playbook.relevance * 100)}% relevant)`,
      ...playbook.steps.map((step) => `  - ${step}`),
    ]);
    return [
      `# Roblox production brief`,
      `## Objective\n${run.goal}`,
      `## Experience pillars\n${profile.experiencePillars.map((item) => `- ${item}`).join("\n")}`,
      `## Specialist stack\n${laneLines.join("\n")}`,
      `## Authority contract\n${profile.ownershipRules.map((item) => `- ${item}`).join("\n")}`,
      `## Implementation order\n${profile.implementationOrder.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `## Definition of done\n${profile.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`,
      `## Verification ladder\n${profile.verificationGates.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `## Release blockers\n${profile.releaseBlockers.map((item) => `- ${item}`).join("\n")}`,
      ...(playbookSteps.length ? [`## Reusable playbooks applied\n${playbookSteps.join("\n")}`] : []),
      ...(priorLessons.length ? [`## Prior lessons applied\n${priorLessons.join("\n")}`] : []),
      `## Local evidence\n${evidenceLines.length ? evidenceLines.join("\n") : "No project evidence was available; do not treat the plan as implementation-ready yet."}`,
      `Rate the outcome after the work is applied so BlackHole can strengthen the specialist stack that actually worked.`,
    ].join("\n\n");
  }
  if (!run.evidence.length)
    return "BlackHole did not find enough verified local knowledge to complete this safely. Add relevant project notes or skills, then try again.";
  const points = run.evidence.slice(0, 4).map(
    (item, index) =>
      `${index + 1}. ${item.title.replace(/^(Skill|Reference|Vault) · /, "")} · ${item.heading}: ${item.excerpt}`,
  );
  const priorLessons = (run.appliedLessons || []).map(
    (item) =>
      `- ${item.outcome === "failed" ? "Avoid repeating" : "Reuse"}: ${item.lesson}`,
  );
  const playbookSteps = (run.appliedPlaybooks || []).flatMap((playbook) => [
    `Playbook: ${playbook.name}`,
    ...playbook.steps.map((step) => `- ${step}`),
  ]);
  return [
    `Grounded plan for “${run.goal}”`,
    ...(playbookSteps.length ? ["Reusable workflow applied:", ...playbookSteps] : []),
    ...(priorLessons.length ? ["Prior lessons applied:", ...priorLessons] : []),
    ...points,
    "Use the cited local knowledge as the operating constraints. Mark the outcome after applying the plan so BlackHole can learn which skill stack worked.",
  ].join("\n\n");
}

export function buildLearningRecord(
  run: AgentRun,
  timestamp = new Date().toISOString(),
): LearningRecord {
  const skillLabel = run.skillIds.length
    ? `${run.skillIds.length} selected skills`
    : "project knowledge";
  const confidence = Math.min(
    0.82,
    Number((0.3 + run.evidence.length * 0.04 + run.skillIds.length * 0.025).toFixed(2)),
  );
  return {
    id: randomUUID(),
    runId: run.id,
    projectId: run.projectId,
    title: run.goal.length > 88 ? `${run.goal.slice(0, 85)}…` : run.goal,
    lesson: `For this objective, BlackHole used ${skillLabel}, ${run.evidence.length} evidence sources, and ${(run.appliedLessons || []).length} prior lessons. Outcome feedback will strengthen or weaken this recommendation for similar work.`,
    evidenceIds: unique(run.evidence.map((item) => item.memoryId)),
    skillIds: run.skillIds,
    outcome: run.outcome,
    confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function calculateSkillScore(
  current: SkillScore | undefined,
  skillId: string,
  outcome: AgentOutcome | "use",
  timestamp = new Date().toISOString(),
): SkillScore {
  const next: SkillScore = current
    ? { ...current }
    : {
        skillId,
        uses: 0,
        successes: 0,
        partials: 0,
        failures: 0,
        score: 0.5,
        lastUsedAt: timestamp,
      };
  if (outcome === "use") next.uses += 1;
  if (outcome === "success") next.successes += 1;
  if (outcome === "partial") next.partials += 1;
  if (outcome === "failed") next.failures += 1;
  const rated = next.successes + next.partials + next.failures;
  next.score = Number(
    ((1 + next.successes + next.partials * 0.55) / (2 + rated)).toFixed(3),
  );
  next.lastUsedAt = timestamp;
  return next;
}
