"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, Download, Grid2X2, List, Plus, Search, Trash2, X } from "lucide-react";
import type { Connection, Memory, MemoryCategory, Project } from "@/lib/types";
import { MEMORY_CATEGORIES } from "@/lib/types";
import { CategoryPill, EmptyState, formatDate, PageHeader } from "@/components/ui";

type ResponseData = { memories: Memory[]; connections: Connection[]; projects: Project[] };
const blank = { title: "", content: "", category: "note" as MemoryCategory, tags: "", source: "Manual entry", projectId: "" };

export function Memories() {
  const params = useSearchParams();
  const [data, setData] = useState<ResponseData>({ memories: [], connections: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState<string>("all");
  const [grid, setGrid] = useState(true);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [editing, setEditing] = useState(false);
  const [createOpen, setCreateOpen] = useState(params.get("new") === "true");
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const selectedParam = params.get("id");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/memories?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      const next: ResponseData = await response.json();
      setData(next);
      if (selectedParam) setSelected(next.memories.find((item) => item.id === selectedParam) || null);
    }
    setLoading(false);
  }, [query, selectedParam]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  const visible = useMemo(() => category === "all" ? data.memories : data.memories.filter((item) => item.category === category), [category, data.memories]);

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    const response = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), projectId: form.projectId || undefined, archived: false }) });
    setSaving(false);
    if (response.ok) { setCreateOpen(false); setForm(blank); await load(); }
  }
  async function saveSelected(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true);
    const response = await fetch(`/api/memories/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
    setSaving(false); if (response.ok) { setSelected(await response.json()); setEditing(false); await load(); }
  }
  async function remove() {
    if (!selected || !confirm(`Delete “${selected.title}” permanently?`)) return;
    await fetch(`/api/memories/${selected.id}`, { method: "DELETE" }); setSelected(null); await load();
  }
  async function archive() {
    if (!selected) return;
    await fetch(`/api/memories/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) }); setSelected(null); await load();
  }
  const selectedConnections = selected ? data.connections.filter((item) => item.sourceId === selected.id || item.targetId === selected.id) : [];
  return <>
    <PageHeader eyebrow="Memory library" title="Everything you chose to keep." description="Capture ideas, decisions, research, and conversations. BlackHole connects each memory to the rest of your universe." actions={<><a href="/api/export?format=json" className="btn-ghost text-xs"><Download size={14} /> Export</a><button onClick={() => setCreateOpen(true)} className="btn-gold text-xs"><Plus size={15} /> New memory</button></>} />
    <div className="panel mb-5 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
      <label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f675a]" /><input className="input !py-2 !pl-9 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by meaning, title, content, or tag…" /></label>
      <select className="input !w-auto !py-2 text-xs" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{MEMORY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
      <div className="flex rounded-xl border border-white/[.06] p-1"><button onClick={() => setGrid(true)} className={`rounded-lg p-1.5 ${grid ? "bg-amber-300/10 text-amber-300" : "text-[#71695c]"}`} aria-label="Grid view"><Grid2X2 size={15} /></button><button onClick={() => setGrid(false)} className={`rounded-lg p-1.5 ${!grid ? "bg-amber-300/10 text-amber-300" : "text-[#71695c]"}`} aria-label="List view"><List size={15} /></button></div>
    </div>
    {loading ? <div className="grid h-64 place-items-center"><div className="h-7 w-7 animate-spin rounded-full border border-amber-300/20 border-t-amber-300" /></div> : !visible.length ? <EmptyState title="No memories found" body="Try a broader search, or capture the first signal in this part of your universe." href="/memories?new=true" action="Add a memory" /> : <div className={grid ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>{visible.map((memory) => <button onClick={() => { setSelected(memory); setEditing(false); }} key={memory.id} className={`panel group w-full rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-amber-300/25 ${grid ? "min-h-52" : "flex items-center gap-5"}`}><div className={grid ? "" : "min-w-0 flex-1"}><div className="flex items-start justify-between gap-3"><CategoryPill category={memory.category} /><span className="text-[9px] text-[#625b50]">{formatDate(memory.updatedAt)}</span></div><h2 className="font-display mt-4 text-xl leading-6 text-[#e7decb] group-hover:text-amber-200">{memory.title}</h2><p className={`mt-2 text-xs leading-5 text-[#7f7769] ${grid ? "line-clamp-3" : "line-clamp-1"}`}>{memory.content}</p><div className="mt-4 flex flex-wrap gap-1.5">{memory.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-md bg-white/[.035] px-2 py-1 text-[9px] text-[#81796b]">#{tag}</span>)}</div></div></button>)}</div>}

    {(createOpen || selected) && <div className="fixed inset-0 z-[80] flex items-end justify-end bg-black/70 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) { setCreateOpen(false); setSelected(null); } }}><div className="h-[92vh] w-full max-w-2xl overflow-y-auto border-l border-amber-300/15 bg-[#0e0d0a] p-6 shadow-2xl md:p-8">
      <div className="flex items-center justify-between"><p className="eyebrow">{createOpen ? "Capture signal" : "Memory detail"}</p><button className="btn-ghost !p-2" onClick={() => { setCreateOpen(false); setSelected(null); }} aria-label="Close"><X size={17} /></button></div>
      {createOpen ? <MemoryForm form={form} setForm={setForm} projects={data.projects} submit={create} saving={saving} /> : selected && <>
        {!editing ? <div className="mt-7"><CategoryPill category={selected.category} /><h2 className="font-display mt-5 text-4xl leading-tight">{selected.title}</h2><div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[#756e61]"><span>{selected.source}</span><span>·</span><span>{formatDate(selected.updatedAt)}</span></div><p className="mt-8 whitespace-pre-wrap text-sm leading-7 text-[#bbb2a1]">{selected.content}</p><div className="mt-6 flex flex-wrap gap-2">{selected.tags.map((tag) => <span key={tag} className="rounded-lg border border-white/[.06] bg-white/[.025] px-2.5 py-1.5 text-[10px] text-[#8e8678]">#{tag}</span>)}</div><div className="mt-9 border-t border-white/[.06] pt-6"><p className="eyebrow">Connections · {selectedConnections.length}</p><div className="mt-3 space-y-2">{selectedConnections.map((connection) => { const otherId = connection.sourceId === selected.id ? connection.targetId : connection.sourceId; const other = data.memories.find((item) => item.id === otherId); return other ? <button key={connection.id} onClick={() => setSelected(other)} className="flex w-full items-center justify-between rounded-xl border border-white/[.05] bg-white/[.02] p-3 text-left text-xs"><span>{other.title}</span><span className="text-[9px] uppercase text-amber-300/70">{connection.type.replaceAll("_", " ")}</span></button> : null; })}{!selectedConnections.length && <p className="text-xs text-[#71695d]">No strong connection has been found yet.</p>}</div></div><div className="mt-9 flex flex-wrap gap-2"><button onClick={() => setEditing(true)} className="btn-gold text-xs">Edit memory</button><button onClick={archive} className="btn-ghost text-xs"><Archive size={14} /> Archive</button><button onClick={remove} className="btn-ghost text-xs text-red-300"><Trash2 size={14} /> Delete</button></div></div> : <form className="mt-6" onSubmit={saveSelected}><label className="block text-xs text-[#91897a]">Title<input className="input mt-2" value={selected.title} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label><label className="mt-5 block text-xs text-[#91897a]">Content<textarea className="input mt-2 min-h-72 resize-y" value={selected.content} onChange={(event) => setSelected({ ...selected, content: event.target.value })} /></label><label className="mt-5 block text-xs text-[#91897a]">Category<select className="input mt-2" value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value as MemoryCategory })}>{MEMORY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><div className="mt-6 flex gap-2"><button className="btn-gold text-xs" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button><button type="button" className="btn-ghost text-xs" onClick={() => setEditing(false)}>Cancel</button></div></form>}
      </>}
    </div></div>}
  </>;
}

function MemoryForm({ form, setForm, projects, submit, saving }: { form: typeof blank; setForm: (form: typeof blank) => void; projects: Project[]; submit: (event: FormEvent) => void; saving: boolean }) {
  return <form onSubmit={submit} className="mt-7 space-y-5"><div><h2 className="font-display text-3xl">What should I remember?</h2><p className="mt-2 text-xs text-[#7f7769]">Related memories will be discovered automatically after saving.</p></div><label className="block text-xs text-[#91897a]">Title<input required className="input mt-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="A clear, specific title" /></label><label className="block text-xs text-[#91897a]">Content<textarea required className="input mt-2 min-h-52 resize-y" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Write the thought, decision, context, or source material…" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs text-[#91897a]">Category<select className="input mt-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as MemoryCategory })}>{MEMORY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-xs text-[#91897a]">Project<select className="input mt-2" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div><label className="block text-xs text-[#91897a]">Tags<input className="input mt-2" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="ai, product, decision" /></label><label className="block text-xs text-[#91897a]">Source<input className="input mt-2" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label><button className="btn-gold w-full" disabled={saving}>{saving ? "Finding connections…" : "Save to universe"}</button></form>;
}
