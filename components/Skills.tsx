"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, BrainCircuit, CheckCircle2, Orbit, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import type { Memory } from "@/lib/types";
import { formatDate, PageHeader } from "@/components/ui";

type SkillsResponse = { skills: Memory[]; discovered: number };
type SyncResult = { discovered: number; added: number; updated: number; unchanged: number; syncedAt: string };

function displayName(title: string) {
  return title.replace(/^Skill · /, "");
}

export function Skills() {
  const [data, setData] = useState<SkillsResponse>({ skills: [], discovered: 0 });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/skills");
    if (response.ok) setData(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/skills")
      .then((response) => response.json())
      .then((next: SkillsResponse) => { if (active) setData(next); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function sync() {
    setSyncing(true);
    const response = await fetch("/api/skills", { method: "POST" });
    if (response.ok) {
      setResult(await response.json());
      await load();
    }
    setSyncing(false);
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data.skills;
    return data.skills.filter((skill) => `${skill.title} ${skill.content} ${skill.tags.join(" ")}`.toLowerCase().includes(needle));
  }, [data.skills, query]);

  const domains = useMemo(() => new Set(data.skills.flatMap((skill) => skill.tags.filter((tag) => !["codex-skill", "skill", "capability"].includes(tag)))).size, [data.skills]);

  return <>
    <PageHeader
      eyebrow="Capability memory"
      title="Skills that stay with you."
      description="BlackHole mirrors your installed Codex skills into persistent memory, connects them to related knowledge, and makes them available to search and grounded chat."
      actions={<><Link href="/memories?new=true&type=skill" className="btn-ghost text-xs"><Plus size={14} /> Teach a skill</Link><Link href="/universe" className="btn-ghost text-xs"><Orbit size={14} /> View in universe</Link><button onClick={sync} disabled={syncing} className="btn-gold text-xs"><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync skills"}</button></>}
    />

    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <Stat icon={<BrainCircuit size={17} />} label="Remembered skills" value={data.skills.length} />
      <Stat icon={<Sparkles size={17} />} label="Detected locally" value={data.discovered} />
      <Stat icon={<BookOpenText size={17} />} label="Knowledge domains" value={domains} />
    </div>

    {result && <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.04] px-4 py-3 text-xs text-emerald-100/75"><CheckCircle2 size={16} className="text-emerald-300" /><span>Skill memory synchronized: {result.added} added, {result.updated} updated, {result.unchanged} already current.</span></div>}

    <label className="panel relative mb-5 block rounded-2xl p-3"><Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-[#6f675a]" /><input className="input !py-2.5 !pl-10 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Roblox, coding, video, documents, automation…" /></label>

    {loading ? <div className="grid h-64 place-items-center"><div className="h-7 w-7 animate-spin rounded-full border border-amber-300/20 border-t-amber-300" /></div> : visible.length === 0 ? <div className="panel rounded-3xl p-10 text-center"><h2 className="font-display text-2xl">No matching skill memory</h2><p className="mt-2 text-sm text-[#81796b]">Sync installed skills or try a broader search.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((skill) => <Link href={`/memories?id=${skill.id}`} key={skill.id} className="panel group relative min-h-60 overflow-hidden rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-amber-300/25">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/[.035] blur-2xl transition group-hover:bg-amber-300/[.07]" />
      <div className="relative flex items-center justify-between"><span className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_9px_#ffc85d]" /> Skill memory</span><span className="text-[9px] text-[#625b50]">{formatDate(skill.updatedAt)}</span></div>
      <h2 className="font-display relative mt-5 text-2xl leading-7 text-[#e7decb] group-hover:text-amber-100">{displayName(skill.title)}</h2>
      <p className="relative mt-3 line-clamp-3 text-xs leading-5 text-[#827a6c]">{skill.content.replace(/^Capability:\s*/, "")}</p>
      <div className="relative mt-5 flex flex-wrap gap-1.5">{skill.tags.filter((tag) => !["codex-skill", "skill", "capability"].includes(tag)).slice(0, 4).map((tag) => <span key={tag} className="rounded-md bg-white/[.035] px-2 py-1 text-[9px] text-[#8f8677]">#{tag}</span>)}</div>
    </Link>)}</div>}
  </>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="panel rounded-2xl p-5"><div className="flex items-center gap-3 text-amber-300/75">{icon}<span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#776f62]">{label}</span></div><div className="font-display mt-4 text-4xl text-[#e9dfcd]">{value}</div></div>;
}
