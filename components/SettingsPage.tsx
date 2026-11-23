"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Database,
  Download,
  HardDriveDownload,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui";

type Configuration = {
  openaiConfigured: boolean;
  postgresConfigured: boolean;
  authConfigured: boolean;
  storageMode: string;
};
type Backup = {
  filename: string;
  size: number;
  createdAt: string;
  automatic: boolean;
};
type Preview = {
  filename: string;
  memories: number;
  projects: number;
  tasks: number;
  connections: number;
  actions: number;
};
type AuditedAction = {
  id: string;
  title: string;
  status: "completed" | "failed";
  summary: string;
  createdAt: string;
};

export function SettingsPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [actions, setActions] = useState<AuditedAction[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const loadBackups = useCallback(async () => {
    const response = await fetch("/api/backups");
    if (response.ok) setBackups((await response.json()).backups);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/settings").then((response) => response.json()),
      fetch("/api/backups").then((response) => response.json()),
      fetch("/api/actions").then((response) => response.json()),
    ]).then(([nextConfig, nextBackups, nextActions]) => {
      if (active) {
        setConfig(nextConfig);
        setBackups(nextBackups.backups || []);
        setActions(nextActions.actions || []);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function createSnapshot() {
    setWorking(true);
    const response = await fetch("/api/backups", { method: "POST" });
    setMessage(
      response.ok
        ? "A complete local snapshot was created."
        : "The snapshot could not be created.",
    );
    await loadBackups();
    setWorking(false);
  }
  async function inspect(backup: Backup) {
    const response = await fetch(
      `/api/backups?filename=${encodeURIComponent(backup.filename)}`,
    );
    if (response.ok) {
      setPreview(await response.json());
      setRestoreConfirmation("");
    }
  }
  async function restore() {
    if (!preview) return;
    setWorking(true);
    const response = await fetch("/api/backups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: preview.filename,
        confirmation: restoreConfirmation,
      }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `Backup restored. Safety copy: ${result.safetyBackup}`
        : result.error || "Restore failed.",
    );
    if (response.ok) {
      setPreview(null);
      setRestoreConfirmation("");
      await loadBackups();
    }
    setWorking(false);
  }
  async function erase() {
    const response = await fetch("/api/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    if (response.ok) {
      setMessage(
        "All stored memories, projects, tasks, and import history were deleted. Your backups remain available.",
      );
      setConfirmation("");
    } else setMessage("Type the confirmation phrase exactly.");
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.reload();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Control center"
        title="Settings & privacy"
        description="Your keys stay server-side, your data stays under your control, and every important change is recoverable."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel rounded-3xl p-6">
          <SectionTitle
            icon={<Database size={20} />}
            eyebrow="Storage"
            title="Memory engine"
          />
          <p className="mt-5 text-xs leading-6 text-[#8a8273]">
            {config?.storageMode || "Checking configuration…"}
          </p>
          <Status
            label="PostgreSQL + pgvector"
            active={Boolean(config?.postgresConfigured)}
          />
          <p className="mt-3 text-[10px] leading-5 text-[#696256]">
            Local JSON persistence works immediately. Add DATABASE_URL to use
            the included PostgreSQL/pgvector schema.
          </p>
        </section>
        <section className="panel rounded-3xl p-6">
          <SectionTitle
            icon={<KeyRound size={20} />}
            eyebrow="Intelligence"
            title="OpenAI"
          />
          <p className="mt-5 text-xs leading-6 text-[#8a8273]">
            Keys are read only by server routes and never sent to the browser.
          </p>
          <Status
            label="OPENAI_API_KEY"
            active={Boolean(config?.openaiConfigured)}
          />
          <p className="mt-3 text-[10px] leading-5 text-[#696256]">
            Without a key, BlackHole uses deterministic local embeddings and
            citation-first answers.
          </p>
        </section>
        <section className="panel rounded-3xl p-6">
          <SectionTitle
            icon={<LockKeyhole size={20} />}
            eyebrow="Access"
            title="Owner authentication"
          />
          <Status
            label="Password + signed session"
            active={Boolean(config?.authConfigured)}
          />
          <p className="mt-3 text-[10px] leading-5 text-[#696256]">
            Set APP_PASSWORD and AUTH_SECRET to require a password and create an
            HTTP-only signed session.
          </p>
          <button onClick={logout} className="btn-ghost mt-5 text-xs">
            <LogOut size={14} /> Sign out
          </button>
        </section>
        <section className="panel rounded-3xl p-6">
          <SectionTitle
            icon={<Download size={20} />}
            eyebrow="Portability"
            title="Export your universe"
          />
          <p className="mt-5 text-xs leading-6 text-[#8a8273]">
            Download every memory and relationship in an open format.
          </p>
          <div className="mt-4 flex gap-2">
            <a className="btn-gold text-xs" href="/api/export?format=json">
              Export JSON
            </a>
            <a className="btn-ghost text-xs" href="/api/export?format=markdown">
              Export Markdown
            </a>
          </div>
        </section>
      </div>

      <section className="panel mt-6 rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle
            icon={<HardDriveDownload size={20} />}
            eyebrow="Recovery"
            title="Automatic snapshots"
          />
          <button
            onClick={createSnapshot}
            disabled={working}
            className="btn-gold text-xs"
          >
            <RefreshCw size={14} className={working ? "animate-spin" : ""} />{" "}
            Back up now
          </button>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-6 text-[#8a8273]">
          BlackHole automatically preserves the state before the first write
          each day and keeps the newest 24 snapshots.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {backups.slice(0, 8).map((backup) => (
            <button
              key={backup.filename}
              onClick={() => inspect(backup)}
              className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.02] p-3 text-left transition hover:border-amber-300/20"
            >
              <div>
                <div className="text-xs text-[#c8bead]">
                  {backup.automatic ? "Automatic" : "Manual"} snapshot
                </div>
                <div className="mt-1 text-[9px] text-[#71695d]">
                  {new Date(backup.createdAt).toLocaleString()} ·{" "}
                  {(backup.size / 1024).toFixed(0)} KB
                </div>
              </div>
              <RotateCcw size={14} className="text-amber-300/60" />
            </button>
          ))}
          {!backups.length && (
            <p className="text-xs text-[#71695d]">
              A snapshot will appear before the next data change.
            </p>
          )}
        </div>
        {preview && (
          <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[.025] p-4">
            <div className="text-[10px] uppercase tracking-[.15em] text-amber-300/70">
              Restore preview
            </div>
            <p className="mt-2 text-xs text-[#bfb5a4]">
              {preview.memories} memories · {preview.projects} projects ·{" "}
              {preview.tasks} tasks · {preview.connections} links ·{" "}
              {preview.actions} audited actions
            </p>
            <p className="mt-2 text-[10px] text-[#71695d]">
              A safety snapshot is created before restoration.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                className="input max-w-sm"
                placeholder="Type RESTORE BACKUP"
              />
              <button
                onClick={restore}
                disabled={working}
                className="btn-ghost text-xs"
              >
                <RotateCcw size={14} /> Restore this snapshot
              </button>
              <button
                onClick={() => setPreview(null)}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel mt-6 rounded-3xl p-6">
        <SectionTitle
          icon={<ClipboardCheck size={20} />}
          eyebrow="Jarvis safety"
          title="Action history"
        />
        <p className="mt-4 text-xs leading-6 text-[#8a8273]">
          Only actions you explicitly confirm are executed, and every result is
          recorded here.
        </p>
        <div className="mt-4 space-y-2">
          {actions.slice(0, 6).map((action) => (
            <div
              key={action.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-white/[.06] bg-white/[.02] p-3"
            >
              <div>
                <div className="text-xs text-[#c8bead]">{action.title}</div>
                <div className="mt-1 text-[9px] text-[#71695d]">
                  {action.summary} ·{" "}
                  {new Date(action.createdAt).toLocaleString()}
                </div>
              </div>
              <span
                className={
                  action.status === "completed"
                    ? "text-[9px] text-emerald-300"
                    : "text-[9px] text-red-300"
                }
              >
                {action.status}
              </span>
            </div>
          ))}
          {!actions.length && (
            <p className="text-xs text-[#71695d]">No confirmed actions yet.</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-red-400/15 bg-red-400/[.025] p-6">
        <SectionTitle
          icon={<Trash2 size={20} />}
          eyebrow="Danger zone"
          title="Delete all private data"
          danger
        />
        <p className="mt-4 max-w-2xl text-xs leading-6 text-[#8a8273]">
          This removes active memories, connections, projects, tasks, and import
          history. Existing backups remain recoverable.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="input max-w-sm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Type DELETE EVERYTHING"
          />
          <button
            onClick={erase}
            className="btn-ghost border-red-400/20 text-xs text-red-300"
          >
            Delete everything
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-[#b9ae9b]">{message}</p>}
      </section>
    </div>
  );
}

function SectionTitle({
  icon,
  eyebrow,
  title,
  danger = false,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={danger ? "text-red-300" : "text-amber-300"}>{icon}</span>
      <div>
        <p className={`eyebrow ${danger ? "!text-red-300" : ""}`}>{eyebrow}</p>
        <h2 className="font-display mt-1 text-2xl">{title}</h2>
      </div>
    </div>
  );
}
function Status({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[.055] p-3">
      <div className="flex items-center gap-2 text-xs text-[#b5ac9b]">
        <Shield size={14} /> {label}
      </div>
      <span
        className={`flex items-center gap-1 text-[9px] uppercase tracking-wider ${active ? "text-emerald-300" : "text-amber-300"}`}
      >
        {active && <Check size={11} />}
        {active ? "Configured" : "Optional"}
      </span>
    </div>
  );
}
