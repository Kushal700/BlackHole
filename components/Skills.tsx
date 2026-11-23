"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, BrainCircuit, CheckCircle2, Network, Orbit, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import type { Memory } from "@/lib/types";
import { formatDate, PageHeader } from "@/components/ui";

type DiscoverySummary = { total: number; skills: number; references: number; vaultNotes: number };
type SkillsResponse = { skills: Memory[]; discovered: DiscoverySummary };
type SyncResult = DiscoverySummary & { discovered: number; added: number; updated: number; removed: number; unchanged: number; syncedAt: string };

function displayName(title: string) {
  return title.replace(/^(Skill|Reference|Vault) · /, "");
}

export function Skills() {
  const [data, setData] = useState<SkillsResponse>({ skills: [], discovered: { total: 0, skills: 0, references: 0, vaultNotes: 0 } });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [kind, setKind] = useState<"all" | "skill" | "reference" | "vault">("skill");
  const [limit, setLimit] = useState(30);

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
    return data.skills.filter((skill) => {
      const matchesKind = kind === "all" || (kind === "vault" && skill.tags.includes("obsidian-vault")) || (kind === "reference" && skill.tags.includes("skill-reference")) || (kind === "skill" && skill.tags.includes("codex-skill") && !skill.tags.includes("skill-reference"));
      return matchesKind && (!needle || `${skill.title} ${skill.content} ${skill.tags.join(" ")}`.toLowerCase().includes(needle));
    });
  }, [data.skills, kind, query]);

  const domains = useMemo(() => new Set(data.skills.flatMap((skill) => skill.tags.filter((tag) => !["codex-skill", "skill", "capability", "skill-reference", "implementation", "obsidian-vault", "obsidian-note", "concept", "topic", "playbook"].includes(tag)))).size, [data.skills]);

  return <>
    <PageHeader
      eyebrow="Skills + knowledge vault"
      title="Everything you learn stays connected."
      description="BlackHole mirrors installed Codex skills, their implementation references, and your Roblox Obsidian vault into persistent local memory. Obsidian wikilinks become real graph connections."
      actions={<><Link href="/memories?new=true&type=skill" className="btn-ghost text-xs"><Plus size={14} /> Teach knowledge</Link><Link href="/universe" className="btn-ghost text-xs"><Orbit size={14} /> View in universe</Link><button onClick={sync} disabled={syncing} className="btn-gold text-xs"><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync library"}</button></>}
    />

    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={<BrainCircuit size={17} />} label="Installed skills" value={data.discovered.skills} />
      <Stat icon={<BookOpenText size={17} />} label="Skill references" value={data.discovered.references} />
      <Stat icon={<Network size={17} />} label="Vault notes" value={data.discovered.vaultNotes} />
      <Stat icon={<Sparkles size={17} />} label="Knowledge domains" value={domains} />
    </div>

    {result && <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.04] px-4 py-3 text-xs text-emerald-100/75"><CheckCircle2 size={16} className="text-emerald-300" /><span>Knowledge synchronized: {result.added} added, {result.updated} updated, {result.removed} removed, {result.unchanged} already current.</span></div>}

    <div className="panel mb-5 rounded-2xl p-3">
      <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f675a]" /><input className="input !py-2.5 !pl-10 text-sm" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(30); }} placeholder="Search Roblox, Blender, Luau, animation, VFX, UI…" /></div>
      <div className="mt-3 flex flex-wrap gap-2">{([
        ["skill", "Skills", data.discovered.skills],
        ["reference", "References", data.discovered.references],
        ["vault", "Vault notes", data.discovered.vaultNotes],
        ["all", "Everything", data.discovered.total],
      ] as const).map(([value, label, count]) => <button key={value} onClick={() => { setKind(value); setLimit(30); }} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${kind === value ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-white/[.06] bg-white/[.02] text-[#827a6d] hover:text-[#d8cebc]"}`}>{label} <span className="ml-1 opacity-60">{count}</span></button>)}</div>
    </div>

    {loading ? <div className="grid h-64 place-items-center"><div className="h-7 w-7 animate-spin rounded-full border border-amber-300/20 border-t-amber-300" /></div> : visible.length === 0 ? <div className="panel rounded-3xl p-10 text-center"><h2 className="font-display text-2xl">No matching knowledge</h2><p className="mt-2 text-sm text-[#81796b]">Sync the local library or try a broader search.</p></div> : <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.slice(0, limit).map((skill) => <Link href={`/memories?id=${skill.id}`} key={skill.id} className="panel group relative min-h-60 overflow-hidden rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-amber-300/25">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/[.035] blur-2xl transition group-hover:bg-amber-300/[.07]" />
      <div className="relative flex items-center justify-between"><span className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_9px_#ffc85d]" /> {skill.tags.includes("obsidian-vault") ? "Vault note" : skill.tags.includes("skill-reference") ? "Skill reference" : "Codex skill"}</span><span className="text-[9px] text-[#625b50]">{formatDate(skill.updatedAt)}</span></div>
      <h2 className="font-display relative mt-5 text-2xl leading-7 text-[#e7decb] group-hover:text-amber-100">{displayName(skill.title)}</h2>
      <p className="relative mt-3 line-clamp-3 text-xs leading-5 text-[#827a6c]">{skill.content.replace(/^Capability:\s*/, "")}</p>
      <div className="relative mt-5 flex flex-wrap gap-1.5">{skill.tags.filter((tag) => !["codex-skill", "skill", "capability", "obsidian-vault", "obsidian-note", "skill-reference"].includes(tag)).slice(0, 4).map((tag) => <span key={tag} className="rounded-md bg-white/[.035] px-2 py-1 text-[9px] text-[#8f8677]">#{tag}</span>)}</div>
    </Link>)}</div>{visible.length > limit && <div className="mt-6 text-center"><button className="btn-ghost text-xs" onClick={() => setLimit((current) => current + 30)}>Show 30 more <span className="text-[#6f675a]">({visible.length - limit} remaining)</span></button></div>}</>}
  </>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="panel rounded-2xl p-5"><div className="flex items-center gap-3 text-amber-300/75">{icon}<span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#776f62]">{label}</span></div><div className="font-display mt-4 text-4xl text-[#e9dfcd]">{value}</div></div>;
}
