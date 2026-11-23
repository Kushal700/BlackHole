"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, FolderKanban, Home, Library, Search, SlidersHorizontal, X } from "lucide-react";
import type { Connection, Memory } from "@/lib/types";
import { MEMORY_CATEGORIES } from "@/lib/types";
import { CategoryPill } from "@/components/ui";

const UniverseScene = dynamic(() => import("@/components/UniverseScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-black"><div className="h-8 w-8 animate-spin rounded-full border border-amber-300/20 border-t-amber-100" /></div>,
});

export function Universe() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Memory | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/memories").then((response) => response.json()).then((data) => {
      setMemories(data.memories || []);
      setConnections(data.connections || []);
    });
  }, []);

  const visible = useMemo(() => memories.filter((memory) =>
    (filter === "all" || (filter === "skills" ? memory.tags.includes("skill") : memory.category === filter)) &&
    (!query || `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
  ), [filter, memories, query]);
  const visibleIds = useMemo(() => new Set(visible.map((item) => item.id)), [visible]);
  const visibleConnections = connections.filter((item) => visibleIds.has(item.sourceId) && visibleIds.has(item.targetId));
  const fragments = visible.reduce((sum, memory) => sum + Math.min(42, Math.max(22, Math.round(memory.content.length / 20))) + 1, 0);

  return <div className="relative h-screen min-h-[620px] overflow-hidden bg-black">
    <UniverseScene memories={visible} connections={visibleConnections} onSelect={setSelected} />

    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,.46)_100%)]" />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/75 to-transparent" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 md:px-8 md:py-6">
      <Link href="/" className="group flex items-center gap-3">
        <span className="relative grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/60 backdrop-blur-xl"><span className="h-2.5 w-2.5 rounded-full bg-black shadow-[0_0_0_3px_#ffe0a855,0_0_13px_#ffd17f]" /></span>
        <div className="hidden sm:block"><div className="font-display text-sm tracking-wide text-white/90">Second Brain</div><div className="text-[8px] uppercase tracking-[.2em] text-white/35">Memory universe</div></div>
      </Link>
      <nav className="flex items-center gap-1.5 rounded-full border border-white/[.07] bg-black/40 p-1 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] uppercase tracking-[.12em] text-white/55 transition hover:bg-white/[.06] hover:text-white"><Home size={11} /> Home</Link>
        <Link href="/projects" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] uppercase tracking-[.12em] text-white/55 transition hover:bg-white/[.06] hover:text-white"><FolderKanban size={11} /> Projects</Link>
        <Link href="/memories" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] uppercase tracking-[.12em] text-white/55 transition hover:bg-white/[.06] hover:text-white sm:flex"><Library size={11} /> Library</Link>
      </nav>
      <Link href="/chat" className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/45 text-white/55 backdrop-blur-xl transition hover:text-amber-100" aria-label="Ask BlackHole"><BrainCircuit size={14} /></Link>
    </header>

    <div className="pointer-events-none absolute left-5 top-24 z-10 max-w-48 md:left-8 md:top-28">
      <p className="text-[8px] font-semibold uppercase tracking-[.22em] text-white/32">Knowledge topology</p>
      <h1 className="font-display mt-2 text-xl leading-tight text-white/76 md:text-2xl">Your memories,<br /><span className="italic text-amber-100/75">held in orbit.</span></h1>
      <p className="mt-3 hidden text-[9px] leading-4 text-white/28 md:block">Drag to orbit · scroll to travel<br />select any luminous memory</p>
    </div>

    <div className="absolute bottom-5 left-5 z-20 md:bottom-7 md:left-8">
      <button onClick={() => setControlsOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-white/[.08] bg-black/55 px-3 py-2 text-[9px] uppercase tracking-[.12em] text-white/48 backdrop-blur-xl transition hover:text-white/80"><SlidersHorizontal size={12} /> Explore <span className="text-white/25">{visible.length}</span></button>
      {controlsOpen && <div className="absolute bottom-12 left-0 w-[min(330px,calc(100vw-40px))] rounded-2xl border border-white/[.08] bg-[#070707e8] p-3 shadow-2xl backdrop-blur-2xl">
        <label className="relative block"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input className="w-full rounded-xl border border-white/[.08] bg-white/[.025] py-2.5 pl-9 pr-3 text-xs text-white/80 outline-none placeholder:text-white/24 focus:border-amber-100/25" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a memory…" /></label>
        <div className="mt-3 flex flex-wrap gap-1.5">{["all", "skills", ...MEMORY_CATEGORIES].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-2.5 py-1 text-[8px] uppercase tracking-wider transition ${filter === item ? "border-amber-100/25 bg-amber-100/10 text-amber-100" : "border-white/[.07] text-white/30 hover:text-white/60"}`}>{item}</button>)}</div>
      </div>}
    </div>

    <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-white/[.06] bg-black/35 px-3 py-2 text-[8px] uppercase tracking-[.15em] text-white/25 backdrop-blur-lg sm:flex">
      <span>{fragments} signals</span><span className="h-1 w-1 rounded-full bg-amber-100/35" /><span>{visibleConnections.length} links</span>
    </div>

    {selected && <aside className="absolute bottom-3 right-3 top-3 z-30 w-[calc(100%-24px)] max-w-sm overflow-y-auto rounded-[26px] border border-white/[.09] bg-[#080807e8] p-6 shadow-[0_30px_90px_#000] backdrop-blur-2xl md:bottom-5 md:right-5 md:top-5">
      <button onClick={() => setSelected(null)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-white/[.07] text-white/35 transition hover:text-white" aria-label="Close memory"><X size={14} /></button>
      <div className="mt-9"><CategoryPill category={selected.category} /><h2 className="font-display mt-5 text-3xl leading-tight text-[#eee7da]">{selected.title}</h2><p className="mt-5 text-sm leading-7 text-[#a49d90]">{selected.content}</p><div className="mt-5 flex flex-wrap gap-1.5">{selected.tags.map((tag) => <span key={tag} className="rounded-md bg-white/[.04] px-2 py-1 text-[9px] text-[#837b6d]">#{tag}</span>)}</div><div className="mt-6 border-t border-white/[.06] pt-5"><p className="text-[9px] uppercase tracking-[.14em] text-white/25">Source</p><p className="mt-2 text-xs text-white/50">{selected.source}</p></div><Link href={`/memories?id=${selected.id}`} className="btn-gold mt-7 w-full text-xs">Open full memory</Link></div>
    </aside>}
  </div>;
}
