"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import {
  ArrowUp,
  BrainCircuit,
  CheckCircle2,
  Quote,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { ActionProposal, ChatCitation } from "@/lib/types";
import { CategoryPill, PageHeader } from "@/components/ui";
import { RichMarkdown } from "@/components/RichMarkdown";

type Message = {
  role: "user" | "assistant";
  text: string;
  citations?: ChatCitation[];
  grounded?: boolean;
  action?: ActionProposal;
  actionStatus?: "pending" | "running" | "completed" | "cancelled" | "failed";
  actionResult?: string;
};
const prompts = [
  "What does my vault say about server authority?",
  "Create a task: profile the boss fight",
  "Remember that VFX must preserve enemy silhouettes",
  "Sync my knowledge library",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "I’m connected to the memories you deliberately saved. Ask me to recall a decision, trace an idea, or find the context behind a project.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  async function ask(value: string) {
    if (!value.trim() || thinking) return;
    setMessages((items) => [...items, { role: "user", text: value }]);
    setInput("");
    setThinking(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value }),
      });
      const result = await response.json();
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: result.answer || result.error,
          citations: result.citations,
          grounded: result.grounded,
          action: result.proposedAction,
          actionStatus: result.proposedAction ? "pending" : undefined,
        },
      ]);
    } catch {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: "I couldn’t reach the memory engine. Your saved data is still safe; try again in a moment.",
        },
      ]);
    }
    setThinking(false);
  }
  async function confirmAction(index: number, action: ActionProposal) {
    setMessages((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, actionStatus: "running" } : item,
      ),
    );
    try {
      const response = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      setMessages((items) =>
        items.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                actionStatus: response.ok ? "completed" : "failed",
                actionResult: result.summary || result.error,
              }
            : item,
        ),
      );
    } catch {
      setMessages((items) =>
        items.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                actionStatus: "failed",
                actionResult: "The local action service could not be reached.",
              }
            : item,
        ),
      );
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Grounded intelligence"
        title="Ask your second brain."
        description="Answers are retrieved from your private memory universe and linked back to their source. No evidence means no invented answer."
      />
      <div className="panel overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/[.055] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-300/10 text-amber-300">
              <BrainCircuit size={18} />
            </span>
            <div>
              <div className="text-sm">BlackHole AI</div>
              <div className="flex items-center gap-1 text-[9px] text-[#756e61]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
                Memory retrieval online
              </div>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[.06] px-2.5 py-1 text-[9px] text-emerald-300 sm:flex">
            <ShieldCheck size={11} /> Grounded mode
          </span>
        </div>
        <div className="h-[54vh] min-h-[430px] space-y-6 overflow-y-auto p-5 md:p-7">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] ${message.role === "user" ? "rounded-2xl rounded-br-md bg-[#2b2111] px-4 py-3 text-sm text-[#e7dbc5]" : "w-full"}`}
              >
                {message.role === "assistant" && (
                  <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-amber-300/75">
                    <Sparkles size={12} /> BlackHole
                  </div>
                )}
                {message.role === "assistant" ? (
                  <RichMarkdown content={message.text} compact />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-7">
                    {message.text}
                  </div>
                )}
                {message.action && (
                  <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[.15em] text-amber-300/70">
                          Proposed local action
                        </div>
                        <h3 className="mt-2 text-sm text-[#eadfcb]">
                          {message.action.title}
                        </h3>
                        <p className="mt-1 text-[11px] leading-5 text-[#857d70]">
                          {message.action.description}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/[.07] px-2 py-1 text-[8px] uppercase text-[#766f63]">
                        {message.action.risk} risk
                      </span>
                    </div>
                    {message.actionResult && (
                      <div
                        className={`mt-3 flex items-center gap-2 text-xs ${message.actionStatus === "completed" ? "text-emerald-300" : "text-red-300"}`}
                      >
                        {message.actionStatus === "completed" ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <XCircle size={14} />
                        )}
                        {message.actionResult}
                      </div>
                    )}
                    {message.actionStatus === "pending" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => confirmAction(index, message.action!)}
                          className="btn-gold text-xs"
                        >
                          <CheckCircle2 size={14} /> Confirm action
                        </button>
                        <button
                          onClick={() =>
                            setMessages((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      actionStatus: "cancelled",
                                      actionResult:
                                        "Action cancelled. Nothing changed.",
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="btn-ghost text-xs"
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      </div>
                    )}
                    {message.actionStatus === "running" && (
                      <div className="mt-4 text-xs text-amber-200/70">
                        Executing locally…
                      </div>
                    )}
                  </div>
                )}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {message.citations.map((citation, citationIndex) => (
                      <Link
                        href={`/memories?id=${citation.id}`}
                        key={citation.id}
                        className="group rounded-xl border border-amber-300/10 bg-amber-300/[.025] p-3 hover:border-amber-300/25"
                      >
                        <div className="flex items-center gap-2">
                          <Quote size={12} className="text-amber-300/70" />
                          <span className="text-[9px] text-amber-300/70">
                            Source {citationIndex + 1}
                          </span>
                          <CategoryPill category={citation.category} />
                        </div>
                        <div className="mt-2 text-xs text-[#c3baa9] group-hover:text-amber-200">
                          {citation.title}
                        </div>
                        {citation.heading && (
                          <div className="mt-1 text-[9px] text-amber-200/55">
                            {citation.heading}
                            {citation.lineStart
                              ? ` · line ${citation.lineStart}`
                              : ""}
                          </div>
                        )}
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#736c5e]">
                          {citation.excerpt}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-xs text-[#776f61]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 [animation-delay:300ms]" />{" "}
              Searching your universe…
            </div>
          )}
        </div>
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 px-5 pb-4 md:px-7">
            {prompts.map((prompt) => (
              <button
                onClick={() => ask(prompt)}
                key={prompt}
                className="btn-ghost !rounded-full !px-3 !py-1.5 text-[10px]"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={submit}
          className="border-t border-white/[.055] p-4 md:p-5"
        >
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(input);
                }
              }}
              className="input min-h-24 resize-none !rounded-2xl !pb-12"
              placeholder="Ask about a project, decision, person, or unfinished thought…"
            />
            <div className="absolute bottom-3 left-3 text-[9px] text-[#615a4e]">
              Enter to send · Shift + Enter for a new line
            </div>
            <button
              disabled={!input.trim() || thinking}
              className="btn-gold absolute bottom-3 right-3 !rounded-full !p-2.5"
              aria-label="Send"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
