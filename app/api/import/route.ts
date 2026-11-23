import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import mammoth from "mammoth";
import Papa from "papaparse";
import { PDFParse } from "pdf-parse";
import { guard } from "@/lib/http";
import { addImport, createMemory, readStore } from "@/lib/store";
import type { MemoryCategory } from "@/lib/types";

export const runtime = "nodejs";

type Extracted = { title: string; content: string; category: MemoryCategory; source: string };

function normalizedHash(value: string) {
  return createHash("sha256").update(value.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

async function extract(file: File): Promise<Extracted[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "txt";
  const buffer = Buffer.from(await file.arrayBuffer());
  const base = file.name.replace(/\.[^.]+$/, "");
  if (["txt", "md"].includes(extension)) {
    return [{ title: base, content: buffer.toString("utf8"), category: extension === "md" ? "note" : "document", source: `Import: ${file.name}` }];
  }
  if (extension === "pdf") {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return [{ title: base, content: result.text, category: "document", source: `PDF import: ${file.name}` }];
  }
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return [{ title: base, content: result.value, category: "document", source: `DOCX import: ${file.name}` }];
  }
  if (extension === "json") {
    const value = JSON.parse(buffer.toString("utf8"));
    const rows = Array.isArray(value) ? value : [value];
    return rows.map((row, index) => ({
      title: String(row.title || row.name || `${base} ${index + 1}`),
      content: String(row.content || row.text || row.description || JSON.stringify(row, null, 2)),
      category: "document" as const,
      source: `JSON import: ${file.name}`,
    }));
  }
  if (extension === "csv") {
    const parsed = Papa.parse<Record<string, string>>(buffer.toString("utf8"), { header: true, skipEmptyLines: true });
    return parsed.data.map((row, index) => ({
      title: row.title || row.name || `${base} ${index + 1}`,
      content: row.content || row.text || row.description || Object.entries(row).map(([key, value]) => `${key}: ${value}`).join("\n"),
      category: "document" as const,
      source: `CSV import: ${file.name}`,
    }));
  }
  if (extension === "zip") {
    const zip = await JSZip.loadAsync(buffer);
    const entries: Extracted[] = [];
    for (const [name, item] of Object.entries(zip.files)) {
      if (!item.dir && name.toLowerCase().endsWith(".md")) {
        entries.push({
          title: name.split("/").pop()?.replace(/\.md$/i, "") || name,
          content: await item.async("text"),
          category: "note",
          source: `Obsidian vault: ${file.name}/${name}`,
        });
      }
    }
    return entries;
  }
  throw new Error(`Unsupported file type: .${extension}`);
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ error: "Choose at least one file" }, { status: 400 });
  const store = await readStore();
  const existing = new Set(store.memories.map((item) => normalizedHash(item.content)));
  let importedCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];
  for (const file of files) {
    try {
      const entries = await extract(file);
      for (const entry of entries) {
        if (!entry.content.trim()) continue;
        const hash = normalizedHash(entry.content);
        if (existing.has(hash)) {
          duplicateCount += 1;
          continue;
        }
        await createMemory({ ...entry, tags: ["imported"], archived: false });
        existing.add(hash);
        importedCount += 1;
      }
      await addImport({
        fileName: file.name,
        type: file.type || file.name.split(".").pop() || "unknown",
        status: "completed",
        importedCount,
        duplicateCount,
      });
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "Import failed"}`);
      await addImport({ fileName: file.name, type: file.type, status: "failed", importedCount: 0, duplicateCount: 0 });
    }
  }
  return NextResponse.json({ importedCount, duplicateCount, errors });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const store = await readStore();
  return NextResponse.json({ imports: store.imports });
}

