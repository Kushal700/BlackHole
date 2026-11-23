"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, CircleCheck, FolderOpen, Orbit, Sparkles, Zap } from "lucide-react";
import type { Memory, Project, Task } from "@/lib/types";
import { CategoryPill, formatDate } from "@/components/ui";

type Stats = { memories: number; connections: number; activeProjects: number; openTasks: number; recent: Memory[]; projects: Project[]; tasks: Task[] };

export function Dashboard() {
  const [data, setData] = useState<Stats | null>(null);
  useEffect(() => { fetch("/api/stats").then((response) => response.json()).then(setData); }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (!data) return <div className="grid min-h-[60vh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border border-amber-300/20 border-t-amber-300" /></div>;
  const stats = [
    { label: "Memories", value: data.memories, icon: BrainCircuit },
    { label: "Connections", value: data.connections, icon: Orbit },
    { label: "Active projects", value: data.activeProjects, icon: FolderOpen },
    { label: "Open tasks", value: data.openTasks, icon: CircleCheck },
  ];
  return <>
    <section className="relative mb-7 overflow-hidden rounded-[30px] border border-amber-300/10 bg-[#0d0b08] px-6 py-10 md:px-10 md:py-12">
      <div className="absolute -right-14 -top-40 h-[420px] w-[420px] rounded-full border border-amber-300/10 shadow-[inset_0_0_100px_#d7972817,0_0_100px_#d7972810]" />
      <div className="absolute right-20 top-1/2 hidden h-24 w-24 -translate-y-1/2 rounded-full bg-black shadow-[0_0_0_18px_#d8952220,0_0_85px_#f0b64766] md:block"><div className="absolute -inset-10 rounded-[50%] border border-amber-300/20 [transform:rotateX(70deg)]" /></div>
      <div className="relative max-w-2xl">
        <p className="eyebrow">{greeting}, Kushal</p>
        <h1 className="font-display mt-4 text-4xl leading-[1.08] md:text-6xl">Your universe is<br /><span className="gold-text italic">remembering.</span></h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[#918979]">Every note, decision, and unfinished idea becomes part of a connected intelligence you can return to.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/chat" className="btn-gold text-sm"><Sparkles size={15} /> Ask your second brain</Link><Link href="/universe" className="btn-ghost text-sm">Explore universe <ArrowRight size={15} /></Link></div>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => <div key={stat.label} className="panel rounded-2xl p-4 md:p-5"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.13em] text-[#756e60]">{stat.label}</span><stat.icon size={16} className="text-amber-300/70" /></div><div className="font-display mt-4 text-3xl text-[#efe4cd]">{stat.value.toLocaleString()}</div></div>)}
    </div>

    <div className="mt-7 grid gap-7 xl:grid-cols-[1.3fr_.7fr]">
      <section className="panel rounded-3xl p-5 md:p-6">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Latest signals</p><h2 className="font-display mt-2 text-2xl">Recent memories</h2></div><Link href="/memories" className="text-xs text-amber-300/80 hover:text-amber-200">View library →</Link></div>
        <div className="mt-5 divide-y divide-white/[.055]">
          {data.recent.map((memory) => <Link href={`/memories?id=${memory.id}`} key={memory.id} className="group flex gap-4 py-4 first:pt-1"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70 shadow-[0_0_8px_#e7b85c]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-medium text-[#ddd4c2] group-hover:text-amber-200">{memory.title}</h3><CategoryPill category={memory.category} /></div><p className="mt-1.5 line-clamp-1 text-xs text-[#777063]">{memory.content}</p></div><span className="hidden shrink-0 text-[10px] text-[#625b50] sm:block">{formatDate(memory.updatedAt)}</span></Link>)}
        </div>
      </section>
      <div className="space-y-7">
        <section className="panel rounded-3xl p-5 md:p-6">
          <p className="eyebrow">In motion</p><h2 className="font-display mt-2 text-2xl">Active projects</h2>
          <div className="mt-5 space-y-5">{data.projects.filter((project) => project.status === "active").map((project) => <Link href={`/projects?id=${project.id}`} key={project.id} className="block"><div className="flex justify-between gap-3 text-sm"><span>{project.name}</span><span className="text-amber-300">{project.progress}%</span></div><div className="mt-2 h-1 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-[#7d521d] to-[#e9b854]" style={{ width: `${project.progress}%` }} /></div><p className="mt-2 line-clamp-1 text-[11px] text-[#756e61]">{project.goal}</p></Link>)}</div>
        </section>
        <section className="overflow-hidden rounded-3xl border border-amber-300/15 bg-gradient-to-br from-[#251b0c] to-[#0d0c09] p-6">
          <Zap size={18} className="text-amber-300" /><p className="eyebrow mt-4">AI observation</p><p className="font-display mt-2 text-xl leading-7">Your recent decisions cluster around <span className="text-amber-300">clarity and trust.</span></p><p className="mt-3 text-xs leading-5 text-[#8a806f]">The citation rule and combat readability decision share a preference for legible systems.</p>
        </section>
      </div>
    </div>
  </>;
}

