import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { MemoryCategory } from "@/lib/types";

export const categoryColors: Record<MemoryCategory, string> = {
  idea: "#e7b85c", note: "#92b6a7", project: "#d58d54", decision: "#bb9bd5",
  research: "#71a8c5", conversation: "#c89581", document: "#9ea1c9", task: "#cf8d8d",
};

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow mb-3">{eyebrow}</p><h1 className="font-display text-4xl tracking-tight md:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8f8879]">{description}</p></div>{actions && <div className="flex shrink-0 gap-2">{actions}</div>}</div>;
}

export function CategoryPill({ category }: { category: MemoryCategory }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em]" style={{ color: categoryColors[category], borderColor: `${categoryColors[category]}33`, background: `${categoryColors[category]}0c` }}><span className="h-1 w-1 rounded-full" style={{ background: categoryColors[category] }} />{category}</span>;
}

export function EmptyState({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return <div className="panel rounded-2xl p-10 text-center"><div className="mx-auto h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_30px_10px_#d9933240]" /><h3 className="font-display mt-6 text-2xl">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#81796b]">{body}</p>{href && <Link href={href} className="btn-gold mt-5 text-sm">{action}<ChevronRight size={15} /></Link>}</div>;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

