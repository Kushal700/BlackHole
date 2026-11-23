"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import { CheckCircle2, FileArchive, FileText, History, UploadCloud, X } from "lucide-react";
import type { ImportRecord } from "@/lib/types";
import { formatDate, PageHeader } from "@/components/ui";

export function Importer() {
  const [files, setFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; duplicateCount: number; errors: string[] } | null>(null);
  async function loadHistory() { const response = await fetch("/api/import"); if (response.ok) setHistory((await response.json()).imports); }
  useEffect(() => { fetch("/api/import").then((response) => response.json()).then((data) => setHistory(data.imports || [])); }, []);
  function select(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) setFiles((items) => [...items, ...Array.from(event.target.files!)]); }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); setFiles((items) => [...items, ...Array.from(event.dataTransfer.files)]); }
  async function start() { if (!files.length) return; setWorking(true); setResult(null); const form = new FormData(); files.forEach((file) => form.append("files", file)); const response = await fetch("/api/import", { method: "POST", body: form }); const data = await response.json(); setResult(data); setWorking(false); if (response.ok) { setFiles([]); loadHistory(); } }
  return <>
    <PageHeader eyebrow="Knowledge ingestion" title="Bring your past with you." description="Import notes, documents, structured data, or an entire Obsidian vault. Exact duplicates are skipped and new memories are connected automatically." />
    <div className="grid gap-7 xl:grid-cols-[1fr_.62fr]">
      <div className="space-y-5">
        <label onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`panel flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-3xl border-dashed p-8 text-center transition ${dragging ? "border-amber-300/50 bg-amber-300/[.05]" : "hover:border-amber-300/25"}`}>
          <input type="file" multiple className="hidden" accept=".md,.txt,.pdf,.docx,.json,.csv,.zip" onChange={select} /><span className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[.07] text-amber-300"><UploadCloud size={28} /></span><h2 className="font-display mt-6 text-2xl">Drop knowledge here</h2><p className="mt-2 max-w-sm text-xs leading-5 text-[#7d7567]">Markdown, TXT, PDF, DOCX, JSON, CSV, or an Obsidian vault exported as ZIP.</p><span className="btn-ghost mt-5 text-xs">Choose files</span>
        </label>
        {files.length > 0 && <div className="panel rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs text-[#aaa190]">Ready to import · {files.length}</span><button className="text-[10px] text-[#756d60]" onClick={() => setFiles([])}>Clear all</button></div><div className="space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[.05] p-3"><FileText size={16} className="text-amber-300/70" /><div className="min-w-0 flex-1"><div className="truncate text-xs">{file.name}</div><div className="mt-0.5 text-[9px] text-[#696256]">{(file.size / 1024).toFixed(1)} KB</div></div><button onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X size={14} className="text-[#71695d]" /></button></div>)}</div><button onClick={start} disabled={working} className="btn-gold mt-4 w-full">{working ? "Reading, embedding, and connecting…" : `Import ${files.length} file${files.length > 1 ? "s" : ""}`}</button></div>}
        {result && <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.04] p-5"><div className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={17} /> Import complete</div><p className="mt-2 text-xs text-[#928a7b]">Created {result.importedCount} memories and skipped {result.duplicateCount} exact duplicates.</p>{result.errors?.map((error) => <p key={error} className="mt-2 text-xs text-red-300">{error}</p>)}</div>}
      </div>
      <div className="space-y-5"><section className="panel rounded-3xl p-6"><div className="flex items-center gap-3"><History size={18} className="text-amber-300" /><div><p className="eyebrow">Audit trail</p><h2 className="font-display mt-1 text-2xl">Import history</h2></div></div><div className="mt-5 space-y-3">{history.length ? history.map((item) => <div key={item.id} className="rounded-xl border border-white/[.05] p-3"><div className="flex items-center gap-2"><FileArchive size={14} className="text-[#9e9585]" /><span className="min-w-0 flex-1 truncate text-xs text-[#c8bead]">{item.fileName}</span><span className={`text-[9px] uppercase ${item.status === "completed" ? "text-emerald-300" : "text-red-300"}`}>{item.status}</span></div><div className="mt-2 flex gap-3 text-[9px] text-[#6d6659]"><span>{item.importedCount} created</span><span>{item.duplicateCount} duplicates</span><span>{formatDate(item.createdAt)}</span></div></div>) : <p className="py-8 text-center text-xs text-[#6f685c]">No imports yet.</p>}</div></section><section className="rounded-3xl border border-amber-300/12 bg-amber-300/[.035] p-6"><p className="eyebrow">How it works</p><ol className="mt-4 space-y-3 text-xs leading-5 text-[#8e8677]"><li>1. Text is extracted locally on the server.</li><li>2. Exact duplicates are detected by content fingerprint.</li><li>3. Embeddings reveal related memories.</li><li>4. Original source information remains attached.</li></ol></section></div>
    </div>
  </>;
}
