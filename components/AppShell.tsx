"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  Atom, BrainCircuit, CircleUserRound, FolderKanban, Import, LayoutDashboard,
  Library, Menu, MessageCircleMore, Search, Settings, Sparkles, X, ListTodo,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/universe", label: "Universe", icon: Atom },
  { href: "/memories", label: "Memories", icon: Library },
  { href: "/chat", label: "Ask BlackHole", icon: MessageCircleMore },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/import", label: "Import", icon: Import },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!response.ok) return setError("That password doesn’t match.");
    onSuccess();
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#060503] p-6">
      <div className="absolute h-80 w-80 rounded-full bg-amber-600/10 blur-[100px]" />
      <form onSubmit={submit} className="panel relative w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/10"><BrainCircuit className="text-amber-300" /></div>
        <p className="eyebrow mb-3">Private knowledge system</p>
        <h1 className="font-display text-4xl">Enter BlackHole</h1>
        <p className="mt-3 text-sm leading-6 text-[#8f8879]">Your memory universe is locked. Enter the local owner password to continue.</p>
        <input className="input mt-7 text-center" type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Owner password" />
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <button className="btn-gold mt-4 w-full" type="submit">Unlock universe</button>
      </form>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [auth, setAuth] = useState<{ authenticated: boolean; configured: boolean } | null>(null);
  useEffect(() => { fetch("/api/auth/status").then((response) => response.json()).then(setAuth); }, []);
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!search.trim()) return;
    router.push(`/memories?q=${encodeURIComponent(search.trim())}`);
  }
  if (auth?.configured && !auth.authenticated) return <Login onSuccess={() => setAuth({ ...auth, authenticated: true })} />;
  if (pathname === "/universe") {
    return <div className="min-h-screen overflow-hidden bg-black text-[#f5ecd8]">{children}</div>;
  }
  return (
    <div className="star-field min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col border-r border-[#e9bd6618] bg-[#0b0a08ee] px-4 py-5 backdrop-blur-xl transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-full border border-amber-300/25 bg-black shadow-[0_0_30px_#b7782330]"><span className="h-4 w-4 rounded-full bg-black shadow-[0_0_0_5px_#e4a74655,0_0_18px_#f9c664]" /></span>
            <div><div className="font-display text-xl tracking-wide">BlackHole</div><div className="text-[9px] uppercase tracking-[.22em] text-[#736c5e]">Second brain</div></div>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="text-[#8d8575] lg:hidden" aria-label="Close menu"><X size={19} /></button>
        </div>
        <nav className="mt-9 space-y-1">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition ${active ? "border border-amber-400/15 bg-amber-300/[.08] text-amber-200" : "border border-transparent text-[#898273] hover:bg-white/[.03] hover:text-[#d6cfbf]"}`}><Icon size={17} strokeWidth={1.7} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_9px_#ffc85d]" />}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-amber-300/10 bg-gradient-to-br from-amber-300/[.07] to-transparent p-4">
          <div className="flex items-center gap-2 text-xs text-amber-200"><Sparkles size={14} /> Memory engine online</div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full w-[72%] bg-gradient-to-r from-amber-700 to-amber-300" /></div>
          <p className="mt-2 text-[10px] leading-4 text-[#766f61]">Local persistence active. Add an OpenAI key for synthesized answers.</p>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu overlay" />}
      <div className="app-main min-h-screen pl-[244px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-[#e9bd6614] bg-[#080705c7] px-5 backdrop-blur-xl md:px-8">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost !p-2 lg:hidden" aria-label="Open menu"><Menu size={19} /></button>
          <form onSubmit={submitSearch} className="relative max-w-lg flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#686154]" size={16} />
            <input className="input !rounded-full !py-2.5 !pl-10 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search across your universe…" />
            <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-[#6e675a] sm:block">ENTER</span>
          </form>
          <Link href="/memories?new=true" className="btn-gold !rounded-full !px-4 !py-2.5 text-xs"><Sparkles size={14} /> <span className="hidden sm:inline">Add memory</span></Link>
          <div className="grid h-9 w-9 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10"><CircleUserRound size={18} className="text-amber-200" /></div>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
