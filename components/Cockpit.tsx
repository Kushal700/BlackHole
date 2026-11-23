"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Code2,
  ExternalLink,
  FolderGit2,
  Gamepad2,
  Gauge,
  Orbit,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type {
  ActionRecord,
  Memory,
  Project,
  StudioConnection,
  Task,
} from "@/lib/types";
import { PageHeader, formatDate } from "@/components/ui";
import { skillActivityStrength } from "@/lib/skill-activity";
import { calculateReadiness } from "@/lib/cockpit";

type RecommendedSkill = Memory & { matchedHeading: string; relevance: number };
type CockpitData = {
  projects: Project[];
  activeProject: Project | null;
  tasks: Task[];
  memories: Memory[];
  recommendedSkills: RecommendedSkill[];
  activeSkills: Memory[];
  recentActions: ActionRecord[];
  studioConnection?: StudioConnection;
};

export function Cockpit() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [objective, setObjective] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [releaseStage, setReleaseStage] =
    useState<Project["releaseStage"]>("prototype");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/cockpit");
    if (response.ok) {
      const next = (await response.json()) as CockpitData;
      setData(next);
      setObjective(
        next.activeProject?.currentObjective || next.activeProject?.goal || "",
      );
      setRepositoryUrl(next.activeProject?.repositoryUrl || "");
      setReleaseStage(next.activeProject?.releaseStage || "prototype");
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/cockpit")
      .then((response) => response.json())
      .then((next: CockpitData) => {
        if (!active) return;
        setData(next);
        setObjective(
          next.activeProject?.currentObjective ||
            next.activeProject?.goal ||
            "",
        );
        setRepositoryUrl(next.activeProject?.repositoryUrl || "");
        setReleaseStage(next.activeProject?.releaseStage || "prototype");
      });
    const events = new EventSource("/api/skills/activity/stream");
    events.onmessage = () => {
      void load();
    };
    return () => {
      active = false;
      events.close();
    };
  }, [load]);

  async function selectProject(projectId: string) {
    await fetch("/api/cockpit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    await load();
  }
  async function saveContext() {
    if (!data?.activeProject) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/cockpit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: data.activeProject.id,
        currentObjective: objective,
        repositoryUrl,
        releaseStage,
      }),
    });
    setMessage(
      response.ok ? "Project context saved." : "Context could not be saved.",
    );
    setSaving(false);
    if (response.ok) await load();
  }

  const readiness = useMemo(() => {
    if (!data?.activeProject)
      return { score: 0, checks: [] as Array<[string, boolean]> };
    return calculateReadiness({
      objective,
      repositoryUrl,
      studioLinked: data.studioConnection?.projectId === data.activeProject.id,
      openTasks: data.tasks.filter((task) => task.status !== "done").length,
      memoryCount: data.memories.length,
    });
  }, [data, objective, repositoryUrl]);

  if (!data)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <RefreshCw className="animate-spin text-amber-300" />
      </div>
    );
  if (!data.activeProject)
    return (
      <div>
        <PageHeader
          eyebrow="Mission control"
          title="Project Cockpit"
          description="Create a project first, then BlackHole can coordinate its goals, knowledge, skills, and execution."
        />
        <Link href="/projects" className="btn-gold">
          Create project
        </Link>
      </div>
    );
  const project = data.activeProject;
  const openTasks = data.tasks.filter((task) => task.status !== "done");

  return (
    <div>
      <PageHeader
        eyebrow="Mission control"
        title="Project Cockpit"
        description="One operational view for the active project, its knowledge, skills, Studio connection, and next actions."
        actions={
          <>
            <select
              aria-label="Active project"
              className="input !w-auto !rounded-full !py-2 text-xs"
              value={project.id}
              onChange={(event) => void selectProject(event.target.value)}
            >
              {data.projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Link href="/universe" className="btn-ghost text-xs">
              <Orbit size={14} /> Universe
            </Link>
            <Link href="/chat" className="btn-gold text-xs">
              <BrainCircuit size={14} /> Ask BlackHole
            </Link>
          </>
        }
      />

      <section className="relative mb-6 overflow-hidden rounded-[32px] border border-amber-300/15 bg-[radial-gradient(circle_at_85%_15%,rgba(236,178,73,.14),transparent_35%),linear-gradient(135deg,#171208,#0c0b08_58%,#090909)] p-6 md:p-8">
        <div className="absolute right-8 top-7 hidden h-28 w-28 rounded-full border border-amber-200/15 shadow-[0_0_90px_#d28a2d33,inset_0_0_40px_#000] md:block" />
        <div className="relative max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-2.5 py-1 text-[9px] uppercase tracking-wider text-emerald-300">
              {project.status}
            </span>
            <span className="rounded-full border border-white/[.07] px-2.5 py-1 text-[9px] uppercase tracking-wider text-[#8d8475]">
              {(project.releaseStage || "prototype").replaceAll("_", " ")}
            </span>
          </div>
          <h2 className="font-display mt-5 text-4xl text-[#f2e9da] md:text-5xl">
            {project.name}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#988f80]">
            {project.summary}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-1.5 max-w-xl flex-1 overflow-hidden rounded-full bg-white/[.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-700 to-amber-200"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="font-display text-xl text-amber-200">
              {project.progress}%
            </span>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={<Target size={16} />}
          label="Open tasks"
          value={openTasks.length}
        />
        <Metric
          icon={<BrainCircuit size={16} />}
          label="Project memories"
          value={data.memories.length}
        />
        <Metric
          icon={<Zap size={16} />}
          label="Active skills"
          value={data.activeSkills.length}
        />
        <Metric
          icon={<Gamepad2 size={16} />}
          label="Studio"
          value={data.studioConnection ? data.studioConnection.mode : "Offline"}
        />
        <Metric
          icon={<Gauge size={16} />}
          label="Readiness"
          value={`${readiness.score}%`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <section className="panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Active objective</p>
                <h2 className="font-display mt-2 text-2xl">
                  What BlackHole is optimizing for
                </h2>
              </div>
              <Target className="text-amber-300" />
            </div>
            <textarea
              className="input mt-5 min-h-28 resize-y"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Define the next concrete outcome…"
            />
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <input
                className="input"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="GitHub repository URL"
              />
              <select
                className="input"
                value={releaseStage}
                onChange={(event) =>
                  setReleaseStage(event.target.value as Project["releaseStage"])
                }
              >
                <option value="prototype">Prototype</option>
                <option value="vertical_slice">Vertical slice</option>
                <option value="alpha">Alpha</option>
                <option value="beta">Beta</option>
                <option value="live">Live</option>
              </select>
              <button
                onClick={saveContext}
                disabled={saving}
                className="btn-gold text-xs"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save context"}
              </button>
            </div>
            {message && (
              <p className="mt-3 text-xs text-emerald-300/80">{message}</p>
            )}
          </section>

          <section className="panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Skill stack</p>
                <h2 className="font-display mt-2 text-2xl">
                  Recommended for this objective
                </h2>
              </div>
              <Sparkles className="text-amber-300" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.recommendedSkills.map((skill) => {
                const active = skillActivityStrength(skill) > 0;
                return (
                  <Link
                    href={`/memories?id=${skill.id}`}
                    key={skill.id}
                    className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${active ? "border-amber-200/30 bg-amber-200/[.065] shadow-[0_0_30px_#d99b3530]" : "border-white/[.06] bg-white/[.018] hover:border-amber-300/20"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] uppercase tracking-wider text-amber-300/70">
                        {skill.matchedHeading}
                      </span>
                      {active && (
                        <span className="flex items-center gap-1 text-[8px] uppercase text-amber-100">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-200" />
                          Active
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm text-[#d8cebc]">
                      {skill.title.replace(/^(Skill|Reference) · /, "")}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-[#746d61]">
                      {skill.content}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Execution queue</p>
                <h2 className="font-display mt-2 text-2xl">Next actions</h2>
              </div>
              <Link href="/tasks" className="btn-ghost text-xs">
                Open board
              </Link>
            </div>
            <div className="mt-5 space-y-2">
              {data.tasks
                .slice()
                .sort(
                  (a, b) =>
                    Number(a.status === "done") - Number(b.status === "done"),
                )
                .slice(0, 8)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-xl border border-white/[.05] bg-white/[.015] p-3"
                  >
                    {task.status === "done" ? (
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 text-emerald-400"
                      />
                    ) : (
                      <Circle size={16} className="mt-0.5 text-amber-300/70" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs ${task.status === "done" ? "text-[#777063] line-through" : "text-[#cbc2b1]"}`}
                      >
                        {task.title}
                      </div>
                      <div className="mt-1 text-[9px] uppercase text-[#696257]">
                        {task.priority} · {task.status.replaceAll("_", " ")}
                      </div>
                    </div>
                  </div>
                ))}
              {!data.tasks.length && (
                <p className="text-xs text-[#746d61]">
                  No tasks are attached to this project yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${data.studioConnection ? "bg-emerald-300/10 text-emerald-300" : "bg-white/[.04] text-[#70695d]"}`}
              >
                <Gamepad2 size={19} />
              </span>
              <div>
                <p className="eyebrow">Roblox Studio</p>
                <h2 className="font-display mt-1 text-2xl">
                  {data.studioConnection ? "Linked" : "Not linked"}
                </h2>
              </div>
            </div>
            {data.studioConnection ? (
              <div className="mt-5 space-y-3 text-xs">
                <Detail label="Place" value={data.studioConnection.name} />
                <Detail label="Mode" value={data.studioConnection.mode} />
                <Detail
                  label="Place ID"
                  value={String(data.studioConnection.placeId || "Local file")}
                />
                <Detail
                  label="Universe ID"
                  value={String(data.studioConnection.universeId || "—")}
                />
                <Detail
                  label="Last handshake"
                  value={formatDate(data.studioConnection.lastSeenAt)}
                />
              </div>
            ) : (
              <p className="mt-5 text-xs leading-6 text-[#81796b]">
                Open a place and connect Studio MCP so BlackHole can attach
                development context.
              </p>
            )}
          </section>

          <section className="panel rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <Gauge size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Release readiness</p>
                <h2 className="font-display mt-1 text-2xl">
                  {readiness.score}% prepared
                </h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {readiness.checks.map(([label, complete]) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[#938b7d]">{label}</span>
                  {complete ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <Circle size={14} className="text-[#574f43]" />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="panel rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Live activity</p>
                <h2 className="font-display mt-1 text-2xl">Recent skills</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {data.activeSkills.map((skill) => (
                <Link
                  href={`/memories?id=${skill.id}`}
                  key={skill.id}
                  className="flex items-center gap-3"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-200 shadow-[0_0_9px_#ffc85d]" />
                  <div className="min-w-0">
                    <div className="truncate text-xs text-[#c9bfad]">
                      {skill.title.replace(/^(Skill|Reference) · /, "")}
                    </div>
                    <div className="mt-0.5 text-[9px] text-[#696257]">
                      Used {skill.usageCount || 1}× ·{" "}
                      {skill.lastUsedAt ? formatDate(skill.lastUsedAt) : "now"}
                    </div>
                  </div>
                </Link>
              ))}
              {!data.activeSkills.length && (
                <p className="text-xs text-[#746d61]">
                  Skills light up here as BlackHole uses them.
                </p>
              )}
            </div>
          </section>

          <section className="panel rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <FolderGit2 size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Repository</p>
                <h2 className="font-display mt-1 text-2xl">Source control</h2>
              </div>
            </div>
            {project.repositoryUrl ? (
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex items-center justify-between rounded-xl border border-white/[.06] p-3 text-xs text-[#c9bfad] hover:border-amber-300/20"
              >
                <span className="truncate">{project.repositoryUrl}</span>
                <ExternalLink size={13} />
              </a>
            ) : (
              <p className="mt-5 text-xs text-[#746d61]">
                Add the project repository above to connect code context.
              </p>
            )}
            <div className="mt-4 flex items-center gap-2 text-[9px] text-[#696257]">
              <Code2 size={12} /> Git automation remains confirmation-gated.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex items-center gap-2 text-amber-300/70">
        {icon}
        <span className="text-[9px] uppercase tracking-wider text-[#7c7467]">
          {label}
        </span>
      </div>
      <div className="font-display mt-3 text-2xl text-[#e8decc]">{value}</div>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[.045] pb-2">
      <span className="text-[#71695e]">{label}</span>
      <span className="max-w-[65%] text-right text-[#bdb3a1]">{value}</span>
    </div>
  );
}
