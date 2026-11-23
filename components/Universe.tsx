"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Focus, Search, X } from "lucide-react";
import type { Connection, Memory } from "@/lib/types";
import { MEMORY_CATEGORIES } from "@/lib/types";
import { CategoryPill } from "@/components/ui";

const UniverseScene = dynamic(() => import("@/components/UniverseScene"), { ssr: false, loading: () => <div className="grid h-full place-items-center"><div className="h-8 w-8 animate-spin rounded-full border border-amber-300/20 border-t-amber-300" /></div> });

export function Universe() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Memory | null>(null);
  useEffect(() => { fetch("/api/memories").then((response) => response.json()).then((data) => { setMemories(data.memories); setConnections(data.connections); }); }, []);
  const visible = useMemo(() => memories.filter((memory) => (filter === "all" || memory.category === filter) && (!query || `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))), [filter, memories, query]);
  const visibleIds = useMemo(() => new Set(visible.map((item) => item.id)), [visible]);
  const visibleConnections = connections.filter((item) => visibleIds.has(item.sourceId) && visibleIds.has(item.targetId));
  return <div className="-m-5 md:-m-8">
    <div className="relative h-[calc(100vh-72px)] min-h-[650px] overflow-hidden bg-black">
      <UniverseScene memories={visible} connections={visibleConnections} onSelect={setSelected} />
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-5 pb-20 pt-7 md:px-9">
        <p className="eyebrow">Interactive knowledge graph</p><h1 className="font-display mt-2 text-3xl md:text-5xl">The universe remembers.</h1><p className="mt-2 text-xs text-[#887f6e]">Drag to orbit · Scroll to travel · Select a memory star</p>
      </div>
      <div className="absolute left-5 top-36 w-[calc(100%-40px)] max-w-xs space-y-3 md:left-9">
        <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#756d5f]" /><input className="input bg-black/70 !pl-9 text-xs backdrop-blur-xl" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a star…" /></label>
        <div className="flex flex-wrap gap-1.5">{["all", ...MEMORY_CATEGORIES].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-wider backdrop-blur ${filter === item ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-white/10 bg-black/40 text-[#776f61]"}`}>{item}</button>)}</div>
      </div>
      <div className="absolute bottom-6 left-5 rounded-2xl border border-amber-300/10 bg-black/60 px-4 py-3 backdrop-blur-xl md:left-9"><div className="flex items-center gap-3"><Focus size={16} className="text-amber-300" /><div><div className="text-xs text-[#d3cab8]">{visible.length} memory stars</div><div className="text-[9px] text-[#6d665a]">{visibleConnections.length} live connections</div></div></div></div>
      {selected && <aside className="absolute bottom-4 right-4 top-4 w-[calc(100%-32px)] max-w-sm overflow-y-auto rounded-3xl border border-amber-300/15 bg-[#0d0c09ed] p-6 shadow-2xl backdrop-blur-xl"><button onClick={() => setSelected(null)} className="absolute right-4 top-4 btn-ghost !p-2"><X size={15} /></button><div className="mt-8"><CategoryPill category={selected.category} /><h2 className="font-display mt-5 text-3xl leading-tight">{selected.title}</h2><p className="mt-5 text-sm leading-7 text-[#a69d8c]">{selected.content}</p><div className="mt-5 flex flex-wrap gap-1.5">{selected.tags.map((tag) => <span key={tag} className="rounded-md bg-white/[.04] px-2 py-1 text-[9px] text-[#837b6d]">#{tag}</span>)}</div><Link href={`/memories?id=${selected.id}`} className="btn-gold mt-7 w-full text-xs">Open full memory</Link></div></aside>}
    </div>
  </div>;
}

