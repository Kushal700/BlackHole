"use client";

import { useEffect, useState } from "react";
import { Check, Database, Download, KeyRound, LockKeyhole, LogOut, Shield, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui";

type Configuration = { openaiConfigured: boolean; postgresConfigured: boolean; authConfigured: boolean; storageMode: string };
export function SettingsPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/settings").then((response) => response.json()).then(setConfig); }, []);
  async function erase() { const response = await fetch("/api/settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) }); if (response.ok) { setMessage("All stored memories, projects, tasks, and import history were deleted."); setConfirmation(""); } else setMessage("Type the confirmation phrase exactly."); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }
  return <div className="mx-auto max-w-5xl"><PageHeader eyebrow="Control center" title="Settings & privacy" description="Your keys stay server-side, your data stays under your control, and deletion is explicit." />
    <div className="grid gap-6 md:grid-cols-2">
      <section className="panel rounded-3xl p-6"><div className="flex items-center gap-3"><Database className="text-amber-300" size={20} /><div><p className="eyebrow">Storage</p><h2 className="font-display mt-1 text-2xl">Memory engine</h2></div></div><p className="mt-5 text-xs leading-6 text-[#8a8273]">{config?.storageMode || "Checking configuration…"}</p><Status label="PostgreSQL + pgvector" active={Boolean(config?.postgresConfigured)} /><p className="mt-3 text-[10px] leading-5 text-[#696256]">Local JSON persistence works immediately. Add DATABASE_URL to use the included PostgreSQL/pgvector schema for deployment.</p></section>
      <section className="panel rounded-3xl p-6"><div className="flex items-center gap-3"><KeyRound className="text-amber-300" size={20} /><div><p className="eyebrow">Intelligence</p><h2 className="font-display mt-1 text-2xl">OpenAI</h2></div></div><p className="mt-5 text-xs leading-6 text-[#8a8273]">Keys are read only by server routes and never sent to the browser.</p><Status label="OPENAI_API_KEY" active={Boolean(config?.openaiConfigured)} /><p className="mt-3 text-[10px] leading-5 text-[#696256]">Without a key, BlackHole uses deterministic local embeddings and a citation-first extractive answer.</p></section>
      <section className="panel rounded-3xl p-6"><div className="flex items-center gap-3"><LockKeyhole className="text-amber-300" size={20} /><div><p className="eyebrow">Access</p><h2 className="font-display mt-1 text-2xl">Owner authentication</h2></div></div><Status label="Password + signed session" active={Boolean(config?.authConfigured)} /><p className="mt-3 text-[10px] leading-5 text-[#696256]">Set APP_PASSWORD and AUTH_SECRET to require a password and create an HTTP-only signed session.</p><button onClick={logout} className="btn-ghost mt-5 text-xs"><LogOut size={14} /> Sign out</button></section>
      <section className="panel rounded-3xl p-6"><div className="flex items-center gap-3"><Download className="text-amber-300" size={20} /><div><p className="eyebrow">Portability</p><h2 className="font-display mt-1 text-2xl">Export your universe</h2></div></div><p className="mt-5 text-xs leading-6 text-[#8a8273]">Download every memory and relationship in an open format.</p><div className="mt-4 flex gap-2"><a className="btn-gold text-xs" href="/api/export?format=json">Export JSON</a><a className="btn-ghost text-xs" href="/api/export?format=markdown">Export Markdown</a></div></section>
    </div>
    <section className="mt-6 rounded-3xl border border-red-400/15 bg-red-400/[.025] p-6"><div className="flex items-center gap-3"><Trash2 className="text-red-300" size={20} /><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-red-300">Danger zone</p><h2 className="font-display mt-1 text-2xl">Delete all private data</h2></div></div><p className="mt-4 max-w-2xl text-xs leading-6 text-[#8a8273]">This permanently removes memories, connections, projects, tasks, and import history. Export first if you may need them again.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input className="input max-w-sm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type DELETE EVERYTHING" /><button onClick={erase} className="btn-ghost border-red-400/20 text-xs text-red-300">Delete everything</button></div>{message && <p className="mt-3 text-xs text-[#b9ae9b]">{message}</p>}</section>
  </div>;
}

function Status({ label, active }: { label: string; active: boolean }) { return <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[.055] p-3"><div className="flex items-center gap-2 text-xs text-[#b5ac9b]"><Shield size={14} /> {label}</div><span className={`flex items-center gap-1 text-[9px] uppercase tracking-wider ${active ? "text-emerald-300" : "text-amber-300"}`}>{active && <Check size={11} />}{active ? "Configured" : "Optional"}</span></div>; }

