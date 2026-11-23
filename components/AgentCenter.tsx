"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  BookOpenCheck,
  BookMarked,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Gauge,
  History,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Orbit,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { PageHeader, formatDate } from "@/components/ui";
import { RichMarkdown } from "@/components/RichMarkdown";
import type {
  AgentRun,
  AgentPlaybook,
  LearningRecord,
  Project,
  SkillScore,
} from "@/lib/types";

interface AgentData {
  runs: AgentRun[];
  learningRecords: LearningRecord[];
  playbooks: AgentPlaybook[];
  skillScores: Array<SkillScore & { title: string }>;
  projects: Project[];
  activeProjectId?: string;
  stats: {
    totalRuns: number;
    completedRuns: number;
    learnedLessons: number;
    ratedRuns: number;
    successRate: number;
    strengthenedSkills: number;
    playbooks: number;
  };
}

const starters = [
  "Plan a secure Roblox boss encounter for the vertical slice",
  "Create a high priority task to audit combat remotes",
  "Remember that boss telegraphs must remain readable on mobile",
];

const statusCopy: Record<AgentRun["status"], string> = {
  planning: "Planning",
  awaiting_approval: "Waiting for approval",
  executing: "Executing",
  verifying: "Verifying",
  learning: "Learning",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Needs attention",
};

export function AgentCenter() {
  const [data, setData] = useState<AgentData | null>(null);
  const [goal, setGoal] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState<"planning" | "executing" | "feedback">();
  const [message, setMessage] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/agent");
    if (!response.ok) return;
    const next = (await response.json()) as AgentData;
    setData(next);
    setSelectedId((current) =>
      current && next.runs.some((run) => run.id === current)
        ? current
        : next.runs[0]?.id,
    );
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/agent")
      .then((response) => response.json())
      .then((next: AgentData) => {
        if (!active) return;
        setData(next);
        setSelectedId(next.runs[0]?.id);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => data?.runs.find((run) => run.id === selectedId) || data?.runs[0],
    [data, selectedId],
  );
  const activeProject = data?.projects.find(
    (project) => project.id === data.activeProjectId,
  );

  async function plan() {
    if (goal.trim().length < 5 || busy) return;
    setBusy("planning");
    setMessage("");
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim() }),
    });
    if (response.ok) {
      const run = (await response.json()) as AgentRun;
      setSelectedId(run.id);
      setGoal("");
      await load();
    } else setMessage("BlackHole could not create that plan.");
    setBusy(undefined);
  }

  async function command(
    run: AgentRun,
    payload:
      | { command: "approve" | "reject" }
      | {
          command: "feedback";
          outcome: "success" | "partial" | "failed";
          feedback?: string;
        }
      | { command: "promote"; name?: string },
  ) {
    setBusy(payload.command === "feedback" ? "feedback" : "executing");
    setMessage("");
    const response = await fetch(`/api/agent/${run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setMessage(body.error || "The agent could not complete that command.");
    }
    await load();
    if (payload.command === "feedback") setFeedbackNote("");
    setBusy(undefined);
  }

  async function removePlaybook(playbook: AgentPlaybook) {
    if (!window.confirm(`Remove the “${playbook.name}” playbook?`)) return;
    const response = await fetch(`/api/agent/playbooks/${playbook.id}`, {
      method: "DELETE",
    });
    if (!response.ok) setMessage("BlackHole could not remove that playbook.");
    await load();
  }

  async function forget(run: AgentRun) {
    if (
      !window.confirm(
        "Forget this run and its lesson? Skill confidence will be rebuilt from the remaining history.",
      )
    )
      return;
    setBusy("feedback");
    const response = await fetch(`/api/agent/${run.id}`, { method: "DELETE" });
    if (!response.ok) setMessage("BlackHole could not forget that run.");
    else setSelectedId(undefined);
    await load();
    setBusy(undefined);
  }

  if (!data)
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <LoaderCircle className="animate-spin text-amber-300" />
      </div>
    );

  const displayState = busy
    ? busy === "feedback"
      ? "Learning"
      : busy === "planning"
        ? "Planning"
        : "Executing"
    : selected
      ? statusCopy[selected.status]
      : "Ready";

  return (
    <div>
      <PageHeader
        eyebrow="Local intelligence"
        title="BlackHole Agent"
        description="A supervised agent that recalls project knowledge, activates skills, executes approved actions, verifies outcomes, and learns from your feedback."
        actions={
          <Link href="/cockpit" className="btn-ghost text-sm">
            <Gauge size={15} /> Project Cockpit
          </Link>
        }
      />

      <section className="agent-hero relative mb-6 overflow-hidden rounded-[32px] border border-amber-300/15 p-5 md:p-7">
        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_.65fr] xl:items-stretch">
          <div className="rounded-3xl border border-white/[.06] bg-black/25 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Give the agent an objective</p>
                <h2 className="font-display mt-2 text-3xl">What should we solve?</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-2 text-xs text-emerald-200">
                <ShieldCheck size={14} /> Supervised mode
              </span>
            </div>
            <textarea
              className="input mt-5 min-h-32 resize-y text-base leading-7"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Describe an outcome, decision, memory, or approved local action…"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setGoal(starter)}
                  className="rounded-full border border-white/[.07] bg-white/[.025] px-3 py-2 text-xs text-[#958d7f] transition hover:border-amber-300/25 hover:text-amber-100"
                >
                  {starter}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-white/[.05] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-[#81796c]">
                <LockKeyhole size={14} className="text-amber-300/70" />
                No code, Studio, publishing, or destructive change runs silently.
              </div>
              <button
                type="button"
                disabled={goal.trim().length < 5 || Boolean(busy)}
                onClick={() => void plan()}
                className="btn-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "planning" ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Build plan
              </button>
            </div>
            {message && <p className="mt-4 text-sm text-red-300">{message}</p>}
          </div>

          <div className="agent-core-card relative grid min-h-72 place-items-center overflow-hidden rounded-3xl border border-amber-200/10 bg-black/35 p-6">
            <div className="agent-orbit agent-orbit-one" />
            <div className="agent-orbit agent-orbit-two" />
            <div className="agent-orbit agent-orbit-three" />
            <div className={`agent-core ${busy ? "agent-core-active" : ""}`}>
              <BrainCircuit size={30} />
            </div>
            <div className="absolute inset-x-4 bottom-5 text-center">
              <div className="text-sm font-medium text-amber-100">{displayState}</div>
              <div className="mt-1 text-xs text-[#736b60]">
                {activeProject?.name || "No active project"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Activity size={16} />} label="Agent runs" value={data.stats.totalRuns} />
        <Metric icon={<Lightbulb size={16} />} label="Lessons learned" value={data.stats.learnedLessons} />
        <Metric icon={<CheckCircle2 size={16} />} label="Rated success" value={data.stats.ratedRuns ? `${data.stats.successRate}%` : "Unrated"} />
        <Metric icon={<Zap size={16} />} label="Skills strengthened" value={data.stats.strengthenedSkills} />
        <Metric icon={<Workflow size={16} />} label="Playbooks" value={data.stats.playbooks} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        <div className="min-w-0 space-y-6">
          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Current run</p>
                <h2 className="font-display mt-2 text-2xl">
                  {selected ? selected.goal : "No objective planned yet"}
                </h2>
              </div>
              {selected && (
                <div className="flex items-center gap-2">
                  <StatusPill status={selected.status} />
                  <button
                    type="button"
                    className="btn-ghost !p-2 text-[#71695d] hover:text-red-200"
                    onClick={() => void forget(selected)}
                    aria-label="Forget this run"
                    title="Forget this run"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>

            {selected ? (
              <>
                <div className="mt-6 space-y-2">
                  {selected.steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex gap-3 rounded-2xl border p-4 ${step.status === "active" ? "border-amber-200/25 bg-amber-200/[.055]" : "border-white/[.05] bg-white/[.012]"}`}
                    >
                      <StepIcon status={step.status} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[#d6ccba]">
                          {step.title}
                          {step.requiresApproval && (
                            <span className="rounded-full border border-amber-300/15 px-2 py-0.5 text-[11px] text-amber-200/75">
                              Approval gate
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#756e62]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {Boolean(selected.appliedLessons?.length) && (
                  <div className="mt-5 rounded-2xl border border-violet-300/10 bg-violet-300/[.025] p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
                      <BookOpenCheck size={16} /> Prior lessons applied
                    </div>
                    <div className="mt-3 space-y-3">
                      {selected.appliedLessons?.map((lesson) => (
                        <div key={lesson.id} className="border-l border-violet-200/15 pl-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-violet-100/80">
                            <span className="capitalize">{lesson.outcome}</span>
                            <span>·</span>
                            <span>{Math.round(lesson.relevance * 100)}% relevant</span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#837a70]">{lesson.lesson}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Boolean(selected.appliedPlaybooks?.length) && (
                  <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.025] p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
                      <Workflow size={16} /> Reusable playbooks applied
                    </div>
                    <div className="mt-3 space-y-3">
                      {selected.appliedPlaybooks?.map((playbook) => (
                        <div key={playbook.id} className="rounded-xl border border-white/[.05] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-[#c5d6d3]">{playbook.name}</span>
                            <span className="text-xs text-cyan-100/70">{Math.round(playbook.relevance * 100)}%</span>
                          </div>
                          <p className="mt-1 text-sm text-[#756e62]">{playbook.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.status === "awaiting_approval" && (
                  <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[.045] p-4">
                    <div className="flex gap-3">
                      <ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={18} />
                      <div>
                        <div className="text-sm font-medium text-amber-100">
                          Review before execution
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#918879]">
                          {selected.proposedAction
                            ? selected.proposedAction.description
                            : "This run will synthesize a grounded result, verify it against local evidence, and record a lesson. It will not change an external system."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="btn-gold"
                        disabled={Boolean(busy)}
                        onClick={() => void command(selected, { command: "approve" })}
                      >
                        {busy === "executing" ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />}
                        Approve and run
                      </button>
                      <button
                        className="btn-ghost"
                        disabled={Boolean(busy)}
                        onClick={() => void command(selected, { command: "reject" })}
                      >
                        <X size={15} /> Reject plan
                      </button>
                    </div>
                  </div>
                )}

                {selected.result && (
                  <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-5">
                    <p className="eyebrow">Agent result</p>
                    <div className="mt-3">
                      <RichMarkdown content={selected.result} compact />
                    </div>
                    {selected.verification && (
                      <div className="mt-4 flex gap-2 border-t border-white/[.05] pt-4 text-sm text-[#81796c]">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                        {selected.verification}
                      </div>
                    )}
                  </div>
                )}

                {selected.status === "completed" && selected.outcome === "unrated" && (
                  <div className="mt-5 rounded-2xl border border-white/[.06] p-4">
                    <div className="text-sm font-medium text-[#d3c9b7]">
                      Did this work?
                    </div>
                    <p className="mt-1 text-sm text-[#776f63]">
                      Your rating and correction teach BlackHole which skills and lessons to trust next time.
                    </p>
                    <textarea
                      className="input mt-4 min-h-20 resize-y text-sm"
                      value={feedbackNote}
                      onChange={(event) => setFeedbackNote(event.target.value)}
                      placeholder="Optional correction: what worked, what failed, or what should change next time?"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <FeedbackButton icon={<ThumbsUp size={14} />} label="Worked" onClick={() => void command(selected, { command: "feedback", outcome: "success", feedback: feedbackNote.trim() || undefined })} />
                      <FeedbackButton icon={<Target size={14} />} label="Partly" onClick={() => void command(selected, { command: "feedback", outcome: "partial", feedback: feedbackNote.trim() || undefined })} />
                      <FeedbackButton icon={<ThumbsDown size={14} />} label="Failed" onClick={() => void command(selected, { command: "feedback", outcome: "failed", feedback: feedbackNote.trim() || undefined })} />
                    </div>
                  </div>
                )}
                {selected.status === "completed" &&
                  ["success", "partial"].includes(selected.outcome) &&
                  !data.playbooks.some((playbook) => playbook.sourceRunId === selected.id) && (
                    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.025] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
                          <BookMarked size={16} /> Reuse this workflow
                        </div>
                        <p className="mt-1 text-sm text-[#756e62]">
                          Save the run as a supervised playbook for similar objectives.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost shrink-0 text-sm"
                        onClick={() => void command(selected, { command: "promote" })}
                      >
                        <Workflow size={15} /> Save playbook
                      </button>
                    </div>
                  )}
              </>
            ) : (
              <p className="mt-5 text-sm leading-7 text-[#81796c]">
                Enter an objective above. BlackHole will recall evidence and show its full plan before doing anything.
              </p>
            )}
          </section>

          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-3">
              <History size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Run history</p>
                <h2 className="font-display mt-1 text-2xl">What the agent has attempted</h2>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {data.runs.slice(0, 10).map((run) => (
                <button
                  type="button"
                  key={run.id}
                  onClick={() => setSelectedId(run.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${run.id === selected?.id ? "border-amber-300/20 bg-amber-300/[.04]" : "border-white/[.05] hover:border-white/10"}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${run.status === "completed" ? "bg-emerald-300" : run.status === "failed" ? "bg-red-300" : "bg-amber-300"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-[#cfc5b3]">{run.goal}</div>
                    <div className="mt-1 text-xs text-[#6f685d]">
                      {statusCopy[run.status]} · {formatDate(run.createdAt)}
                    </div>
                  </div>
                  {run.outcome !== "unrated" && (
                    <span className="text-xs capitalize text-[#8d8578]">{run.outcome}</span>
                  )}
                </button>
              ))}
              {!data.runs.length && <p className="text-sm text-[#756e62]">No runs yet.</p>}
            </div>
          </section>

          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Workflow size={18} className="text-cyan-200" />
              <div>
                <p className="eyebrow">Workflow library</p>
                <h2 className="font-display mt-1 text-2xl">Reusable playbooks</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {data.playbooks.slice(0, 8).map((playbook) => (
                <div key={playbook.id} className="rounded-2xl border border-white/[.05] bg-white/[.012] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-[#c7d3cf]">{playbook.name}</div>
                      <div className="mt-1 text-xs text-[#655f56]">
                        Used {playbook.usageCount}× · {Math.round(playbook.confidence * 100)}% confidence
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removePlaybook(playbook)}
                      className="text-[#625c53] transition hover:text-red-200"
                      aria-label={`Remove ${playbook.name} playbook`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-[#746d62]">
                    {playbook.steps.length} steps · {playbook.skillIds.length} skills
                  </div>
                </div>
              ))}
              {!data.playbooks.length && (
                <p className="text-sm leading-6 text-[#756e62]">
                  Rate a completed run as worked or partial, then save it as a reusable playbook.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Lightbulb size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Learning journal</p>
                <h2 className="font-display mt-1 text-2xl">Accumulated lessons</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {data.learningRecords.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/[.05] bg-white/[.012] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm leading-6 text-[#c8beac]">{item.title}</div>
                    <span className="shrink-0 text-xs text-amber-200">{Math.round(item.confidence * 100)}%</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#756e62]">{item.lesson}</p>
                  {item.feedback && (
                    <p className="mt-3 rounded-xl border border-violet-200/10 bg-violet-200/[.025] px-3 py-2 text-sm leading-6 text-violet-100/70">
                      Correction: {item.feedback}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs text-[#625c52]">
                    <span>{item.skillIds.length} skills · {item.evidenceIds.length} sources</span>
                    <span className="capitalize">{item.outcome}</span>
                  </div>
                </div>
              ))}
              {!data.learningRecords.length && (
                <p className="text-sm leading-6 text-[#756e62]">
                  Completed runs become lessons here. Ratings change future skill confidence.
                </p>
              )}
            </div>
          </section>

          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Orbit size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Skill intelligence</p>
                <h2 className="font-display mt-1 text-2xl">What BlackHole trusts</h2>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {data.skillScores.slice(0, 8).map((skill) => (
                <div key={skill.skillId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-[#bfb5a4]">{skill.title}</span>
                    <span className="text-xs text-amber-200">{Math.round(skill.score * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-700 to-amber-200" style={{ width: `${skill.score * 100}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-[#625c52]">
                    Used {skill.uses}× · {skill.successes} successful · {skill.failures} failed
                  </div>
                </div>
              ))}
              {!data.skillScores.length && (
                <p className="text-sm leading-6 text-[#756e62]">
                  Skill confidence appears after the first approved run and becomes meaningful as you rate outcomes.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex items-center gap-2 text-amber-300/70">
        {icon}
        <span className="text-xs uppercase tracking-wider text-[#7c7467]">{label}</span>
      </div>
      <div className="font-display mt-3 text-2xl text-[#e8decc]">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: AgentRun["status"] }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.045] px-3 py-2 text-xs text-amber-100">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-200" />
      {statusCopy[status]}
    </span>
  );
}

function StepIcon({ status }: { status: AgentRun["steps"][number]["status"] }) {
  if (status === "completed") return <Check size={17} className="mt-0.5 shrink-0 text-emerald-300" />;
  if (status === "active") return <LoaderCircle size={17} className="mt-0.5 shrink-0 animate-spin text-amber-300" />;
  if (status === "failed") return <X size={17} className="mt-0.5 shrink-0 text-red-300" />;
  if (status === "skipped") return <Circle size={17} className="mt-0.5 shrink-0 text-[#4f493f]" />;
  return <Clock3 size={17} className="mt-0.5 shrink-0 text-[#6d6558]" />;
}

function FeedbackButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost text-sm">
      {icon} {label}
    </button>
  );
}
