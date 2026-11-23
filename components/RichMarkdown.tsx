"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
          themeVariables: {
            primaryColor: "#2b2111",
            primaryTextColor: "#eee7da",
            lineColor: "#b78a43",
            background: "#090806",
          },
        });
        const rendered = await mermaid.render(`blackhole-${id}`, chart);
        if (active) setSvg(rendered.svg);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Diagram could not be rendered.",
          );
      });
    return () => {
      active = false;
    };
  }, [chart, id]);

  if (error)
    return (
      <pre className="rich-code">
        <code>{chart}</code>
      </pre>
    );
  return (
    <div
      className="rich-mermaid"
      aria-label="Mermaid diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function normalizeWikilinks(content: string) {
  return content.replace(
    /\[\[([^\]|#^]+)(?:#[^\]|^]+)?(?:\|([^\]]+))?\]\]/g,
    (_, target: string, alias?: string) =>
      `[${(alias || target).trim()}](/memories?q=${encodeURIComponent(target.trim())})`,
  );
}

export function RichMarkdown({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  const markdown = useMemo(() => normalizeWikilinks(content), [content]);
  return (
    <div className={`rich-markdown ${compact ? "rich-markdown-compact" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          pre: ({ children }) => <>{children}</>,
          a: ({ href = "", children }) =>
            href.startsWith("/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          code: ({ className, children, ...props }) => {
            const language = /language-(\w+)/.exec(className || "")?.[1];
            const chart = String(children).replace(/\n$/, "");
            if (language === "mermaid") return <MermaidDiagram chart={chart} />;
            if (language)
              return (
                <pre className="rich-code">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
