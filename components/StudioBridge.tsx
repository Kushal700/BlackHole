"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileCode2,
  FolderPlus,
  Gamepad2,
  History,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, formatDate } from "@/components/ui";
import type {
  StudioBridgeOperation,
  StudioBridgePlan,
} from "@/lib/types";

type StudioInfo = {
  id: string;
  name: string;
  mode: "Edit" | "Play";
  placeId?: number;
  universeId?: number;
  persistedToCloud?: boolean;
};

type StudioSnapshot = {
  services: Array<{
    name: string;
    immediateChildren: number;
    descendants: number;
    scripts: number;
    remotes: number;
  }>;
  totalScripts: number;
  totalRemotes: number;
};

type BridgeData = {
  connected: boolean;
  studio?: StudioInfo;
  studios?: StudioInfo[];
  snapshot: StudioSnapshot | null;
  plans: StudioBridgePlan[];
  activeProjectId?: string;
  warning?: string;
  error?: string;
};

type DraftKind = StudioBridgeOperation["kind"];

const scriptTemplate = `--!strict

local Module = {}

return Module
`;

const statusLabel: Record<StudioBridgePlan["status"], string> = {
  preview_ready: "Preview ready",
  approved: "Approved",
  applying: "Applying",
  verified: "Verified",
  rolled_back: "Rolled back",
  failed: "Needs attention",
};

function operationId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `operation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StudioBridge() {
  const [data, setData] = useState<BridgeData | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [title, setTitle] = useState("Create a safe Studio scaffold");
  const [description, setDescription] = useState(
    "Create a small, reversible structure through the BlackHole Studio bridge.",
  );
  const [kind, setKind] = useState<DraftKind>("create_folder");
  const [parentPath, setParentPath] = useState("ReplicatedStorage");
  const [targetPath, setTargetPath] = useState("ReplicatedStorage");
  const [name, setName] = useState("BlackHoleGenerated");
  const [className, setClassName] = useState<"Script" | "LocalScript" | "ModuleScript">("ModuleScript");
  const [source, setSource] = useState(scriptTemplate);
  const [attributeValue, setAttributeValue] = useState("true");
  const [operations, setOperations] = useState<StudioBridgeOperation[]>([]);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/studio-bridge", { cache: "no-store" });
    const next = (await response.json()) as BridgeData;
    setData(next);
    setSelectedId((current) =>
      current && next.plans?.some((plan) => plan.id === current)
        ? current
        : next.plans?.[0]?.id,
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/studio-bridge", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<BridgeData>)
      .then((next) => {
        setData(next);
        setSelectedId(next.plans?.[0]?.id);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "Studio Bridge could not load.");
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => data?.plans?.find((plan) => plan.id === selectedId) || data?.plans?.[0],
    [data, selectedId],
  );

  function addOperation() {
    setMessage("");
    const id = operationId();
    if (kind === "create_folder")
      setOperations((current) => [
        ...current,
        { id, kind, parentPath: parentPath.trim(), name: name.trim() },
      ]);
    else if (kind === "create_script")
      setOperations((current) => [
        ...current,
        {
          id,
          kind,
          parentPath: parentPath.trim(),
          name: name.trim(),
          className,
          source,
        },
      ]);
    else {
      const parsedValue =
        attributeValue === "true"
          ? true
          : attributeValue === "false"
            ? false
            : attributeValue === "null"
              ? null
              : Number.isFinite(Number(attributeValue)) && attributeValue.trim() !== ""
                ? Number(attributeValue)
                : attributeValue;
      setOperations((current) => [
        ...current,
        {
          id,
          kind,
          targetPath: targetPath.trim(),
          name: name.trim(),
          value: parsedValue,
        },
      ]);
    }
  }

  async function createPreview() {
    if (!data?.studio || !operations.length || busy) return;
    setBusy("preview");
    setMessage("");
    const response = await fetch("/api/studio-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioId: data.studio.id,
        projectId: data.activeProjectId,
        title,
        description,
        operations,
      }),
    });
    const body = (await response.json()) as StudioBridgePlan & { error?: string };
    if (!response.ok) setMessage(body.error || "The dry-run preview failed.");
    else {
      setSelectedId(body.id);
      setOperations([]);
      setMessage("Dry-run complete. Review every target before approval.");
      await load();
    }
    setBusy(undefined);
  }

  async function command(plan: StudioBridgePlan, commandName: "approve" | "execute" | "rollback") {
    if (busy) return;
    if (
      commandName === "execute" &&
      !window.confirm(
        `Apply exactly ${plan.operations.length} approved Studio change${plan.operations.length === 1 ? "" : "s"} to ${plan.studioName}?`,
      )
    )
      return;
    if (
      commandName === "rollback" &&
      !window.confirm(`Rollback the verified Studio batch “${plan.title}”?`)
    )
      return;
    setBusy(commandName);
    setMessage("");
    const response = await fetch(`/api/studio-bridge/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: commandName }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? commandName === "approve"
          ? "Exact preview approved. Studio has not changed yet."
          : commandName === "execute"
            ? "Studio batch applied and verified."
            : "Rollback completed."
        : body.error || "The bridge command failed.",
    );
    await load();
    setBusy(undefined);
  }

  async function removePlan(plan: StudioBridgePlan) {
    if (!window.confirm(`Remove the “${plan.title}” audit entry?`)) return;
    const response = await fetch(`/api/studio-bridge/${plan.id}`, { method: "DELETE" });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) setMessage(body.error || "The plan could not be removed.");
    else setSelectedId(undefined);
    await load();
  }

  if (!data)
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <LoaderCircle className="animate-spin text-amber-300" />
      </div>
    );

  return (
    <div>
      <PageHeader
        eyebrow="Reversible execution"
        title="Studio Execution Bridge"
        description="Inspect the live place, preview a bounded change set, approve the exact targets, apply inside Studio undo history, verify, and roll back."
        actions={
          <button className="btn-ghost text-sm" onClick={() => void load()} disabled={Boolean(busy)}>
            <RefreshCw size={15} className={busy === "refresh" ? "animate-spin" : ""} /> Refresh Studio
          </button>
        }
      />

      <section className="mb-6 overflow-hidden rounded-[32px] border border-amber-300/15 bg-[radial-gradient(circle_at_88%_10%,rgba(236,178,73,.13),transparent_35%),linear-gradient(135deg,#151108,#0b0a08_60%,#080808)] p-5 md:p-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className={`rounded-2xl border p-3 ${data.connected ? "border-emerald-300/15 bg-emerald-300/[.06] text-emerald-200" : "border-red-300/15 bg-red-300/[.05] text-red-200"}`}>
              <PlugZap size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl text-[#eee4d2]">
                  {data.studio?.name || "Studio is offline"}
                </h2>
                {data.studio && (
                  <span className="rounded-full border border-emerald-300/15 px-2.5 py-1 text-[11px] text-emerald-200">
                    {data.studio.mode} · live
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#8d8476]">
                {data.error || data.warning || (data.studio ? `Place ${data.studio.placeId || "local"} · Direct official Studio MCP connection` : "Open a place and enable Studio MCP to use the bridge.")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <SafetyPill icon={<LockKeyhole size={13} />} label="No arbitrary Luau" />
            <SafetyPill icon={<ShieldCheck size={13} />} label="Two-step approval" />
            <SafetyPill icon={<RotateCcw size={13} />} label="Undo + rollback" />
          </div>
        </div>
      </section>

      {data.snapshot && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Scripts inspected" value={data.snapshot.totalScripts} icon={<Code2 size={15} />} />
          <Metric label="Remote boundaries" value={data.snapshot.totalRemotes} icon={<Activity size={15} />} />
          <Metric label="Services mapped" value={data.snapshot.services.length} icon={<Gamepad2 size={15} />} />
          <Metric label="Applied batches" value={data.plans.filter((plan) => plan.status === "verified").length} icon={<CheckCircle2 size={15} />} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        <div className="min-w-0 space-y-6">
          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-3">
              <FolderPlus size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Change composer</p>
                <h2 className="font-display mt-1 text-2xl">Build a bounded batch</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[#8d8578]">
                Batch title
                <input className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="text-sm text-[#8d8578]">
                Operation
                <select className="input mt-2" value={kind} onChange={(event) => setKind(event.target.value as DraftKind)}>
                  <option value="create_folder">Create folder</option>
                  <option value="create_script">Create script</option>
                  <option value="set_attribute">Set attribute</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm text-[#8d8578]">
              Why this change exists
              <textarea className="input mt-2 min-h-20 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>

            <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {kind === "set_attribute" ? (
                  <label className="text-sm text-[#8d8578]">
                    Exact target path
                    <input className="input mt-2" value={targetPath} onChange={(event) => setTargetPath(event.target.value)} />
                  </label>
                ) : (
                  <label className="text-sm text-[#8d8578]">
                    Exact parent path
                    <input className="input mt-2" value={parentPath} onChange={(event) => setParentPath(event.target.value)} />
                  </label>
                )}
                <label className="text-sm text-[#8d8578]">
                  {kind === "set_attribute" ? "Attribute name" : "New instance name"}
                  <input className="input mt-2" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                {kind === "create_script" && (
                  <label className="text-sm text-[#8d8578]">
                    Script class
                    <select className="input mt-2" value={className} onChange={(event) => setClassName(event.target.value as typeof className)}>
                      <option value="ModuleScript">ModuleScript</option>
                      <option value="Script">Script</option>
                      <option value="LocalScript">LocalScript</option>
                    </select>
                  </label>
                )}
                {kind === "set_attribute" && (
                  <label className="text-sm text-[#8d8578]">
                    Value
                    <input className="input mt-2" value={attributeValue} onChange={(event) => setAttributeValue(event.target.value)} />
                  </label>
                )}
              </div>
              {kind === "create_script" && (
                <label className="mt-3 block text-sm text-[#8d8578]">
                  Strict Luau source
                  <textarea className="input mt-2 min-h-52 resize-y font-mono text-xs leading-5" value={source} onChange={(event) => setSource(event.target.value)} />
                </label>
              )}
              <button type="button" className="btn-ghost mt-4 text-sm" onClick={addOperation}>
                <FolderPlus size={15} /> Add to batch
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {operations.map((operation) => (
                <div key={operation.id} className="flex items-center gap-3 rounded-2xl border border-white/[.06] p-3">
                  {operation.kind === "create_script" ? <FileCode2 size={16} className="text-amber-200" /> : <FolderPlus size={16} className="text-amber-200" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[#cfc5b4]">{operation.kind.replaceAll("_", " ")}</div>
                    <div className="mt-1 truncate text-xs text-[#71695f]">
                      {operation.kind === "set_attribute" ? operation.targetPath : `${operation.parentPath}.${operation.name}`}
                    </div>
                  </div>
                  <button type="button" className="text-[#645d52] hover:text-red-200" onClick={() => setOperations((current) => current.filter((item) => item.id !== operation.id))} aria-label="Remove operation">
                    <X size={15} />
                  </button>
                </div>
              ))}
              {!operations.length && <p className="text-sm text-[#746d62]">Add one or more small operations. Nothing is sent to Studio until after preview and approval.</p>}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.05] pt-5">
              <p className="text-xs text-[#746d62]">Dry-run is read-only and checks every target for collisions.</p>
              <button className="btn-gold" disabled={!data.connected || !operations.length || Boolean(busy)} onClick={() => void createPreview()}>
                {busy === "preview" ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Generate dry-run preview
              </button>
            </div>
            {message && <p className={`mt-4 text-sm ${message.toLowerCase().includes("failed") || message.toLowerCase().includes("could not") ? "text-red-300" : "text-emerald-200"}`}>{message}</p>}
          </section>

          <section className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-3">
              <History size={18} className="text-amber-300" />
              <div>
                <p className="eyebrow">Audit ledger</p>
                <h2 className="font-display mt-1 text-2xl">Bridge batches</h2>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {data.plans.slice(0, 12).map((plan) => (
                <button key={plan.id} type="button" onClick={() => setSelectedId(plan.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${selected?.id === plan.id ? "border-amber-300/20 bg-amber-300/[.04]" : "border-white/[.05] hover:border-white/10"}`}>
                  <span className={`h-2 w-2 rounded-full ${plan.status === "verified" ? "bg-emerald-300" : plan.status === "failed" ? "bg-red-300" : "bg-amber-300"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-[#cfc5b4]">{plan.title}</div>
                    <div className="mt-1 text-xs text-[#696257]">{statusLabel[plan.status]} · {formatDate(plan.createdAt)}</div>
                  </div>
                  <ChevronRight size={15} className="text-[#5f584e]" />
                </button>
              ))}
              {!data.plans.length && <p className="text-sm text-[#746d62]">No bridge batches yet.</p>}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="panel rounded-3xl p-5 md:p-6">
            <p className="eyebrow">Approval console</p>
            <h2 className="font-display mt-2 text-2xl">{selected?.title || "No preview selected"}</h2>
            {selected ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusPill plan={selected} />
                  {!(["approved", "applying", "verified"] as StudioBridgePlan["status"][]).includes(selected.status) && (
                    <button type="button" className="text-[#625b50] hover:text-red-200" onClick={() => void removePlan(selected)} aria-label="Remove bridge plan"><Trash2 size={15} /></button>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-[#81796d]">{selected.description}</p>
                <div className="mt-5 space-y-2">
                  {selected.preview.map((item) => (
                    <div key={item.operationId} className={`rounded-2xl border p-4 ${item.safe ? "border-emerald-300/10 bg-emerald-300/[.025]" : "border-red-300/15 bg-red-300/[.03]"}`}>
                      <div className="flex items-start gap-3">
                        {item.safe ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" /> : <X size={16} className="mt-0.5 shrink-0 text-red-300" />}
                        <div className="min-w-0">
                          <div className="text-sm text-[#d0c6b5]">{item.summary}</div>
                          <div className="mt-1 break-all text-xs text-[#736b60]">{item.targetPath}</div>
                          <div className="mt-2 text-xs text-[#8a8276]">{item.reason}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {selected.error && <p className="mt-4 rounded-xl border border-red-300/10 bg-red-300/[.03] p-3 text-sm text-red-200">{selected.error}</p>}
                {selected.verification && <p className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[.025] p-3 text-sm text-emerald-200">{selected.verification}</p>}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[.05] pt-5">
                  {selected.status === "preview_ready" && (
                    <button className="btn-gold" disabled={selected.preview.some((item) => !item.safe) || Boolean(busy)} onClick={() => void command(selected, "approve")}>
                      <ShieldCheck size={15} /> Approve exact preview
                    </button>
                  )}
                  {selected.status === "approved" && (
                    <button className="btn-gold" disabled={Boolean(busy)} onClick={() => void command(selected, "execute")}>
                      {busy === "execute" ? <LoaderCircle size={15} className="animate-spin" /> : <PlugZap size={15} />} Execute in Studio
                    </button>
                  )}
                  {selected.status === "verified" && (
                    <button className="btn-ghost" disabled={Boolean(busy)} onClick={() => void command(selected, "rollback")}>
                      {busy === "rollback" ? <LoaderCircle size={15} className="animate-spin" /> : <RotateCcw size={15} />} Roll back batch
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[#746d62]">Create a dry-run preview to see every exact Studio target here.</p>
            )}
          </section>

          {data.snapshot && (
            <section className="panel rounded-3xl p-5 md:p-6">
              <p className="eyebrow">Read-only map</p>
              <h2 className="font-display mt-2 text-2xl">Live place structure</h2>
              <div className="mt-5 space-y-2">
                {data.snapshot.services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.05] px-3 py-2.5">
                    <span className="text-sm text-[#bdb3a2]">{service.name}</span>
                    <span className="text-xs text-[#6e675c]">{service.scripts} scripts · {service.remotes} remotes · {service.descendants} descendants</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SafetyPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-white/[.07] bg-white/[.02] px-3 py-2 text-xs text-[#9b9284]">{icon}{label}</span>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="panel rounded-2xl p-4"><div className="flex items-center gap-2 text-amber-300/70">{icon}<span className="text-xs uppercase tracking-wider text-[#7a7266]">{label}</span></div><div className="font-display mt-3 text-2xl text-[#eadfce]">{value}</div></div>;
}

function StatusPill({ plan }: { plan: StudioBridgePlan }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.045] px-3 py-2 text-xs text-amber-100"><span className={`h-1.5 w-1.5 rounded-full ${plan.status === "verified" ? "bg-emerald-300" : plan.status === "failed" ? "bg-red-300" : "bg-amber-300"}`} />{statusLabel[plan.status]}</span>;
}
