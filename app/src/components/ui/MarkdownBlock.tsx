import React from "react";
import { Sparkles } from "lucide-react";

/** Inline parser: bolds **text** segments, leaves the rest as plain text. */
export function parseInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/** Lightweight markdown renderer for Arbor AI output (headings, lists, paragraphs). */
export function renderMarkdown(text: string) {
  const paragraphs = text.split("\n\n");
  return paragraphs.map((para, idx) => {
    const content = para.trim();
    if (!content) return null;

    if (content.startsWith("### ")) {
      return (
        <h4
          key={idx}
          className="text-sm font-bold tracking-wider uppercase mt-5 mb-2 pb-1 flex items-center gap-2"
          style={{ color: "#1f8a5a", borderBottom: "1px solid var(--arbor-rule)" }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {content.replace("### ", "")}
        </h4>
      );
    }
    if (content.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base font-extrabold mt-6 mb-3 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {content.replace("## ", "")}
        </h3>
      );
    }
    if (content.startsWith("- ") || content.startsWith("* ")) {
      const items = content.split(/\n[\-*]\s+/);
      return (
        <ul key={idx} className="list-disc pl-5 my-3 space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
          {items.map((item, i) => {
            const cleanItem = item.replace(/^[\-*]\s+/, "");
            return <li key={i}>{parseInline(cleanItem)}</li>;
          })}
        </ul>
      );
    }
    return (
      <p key={idx} className="leading-relaxed text-sm mb-3.5" style={{ color: "var(--arbor-ink)" }}>
        {parseInline(content)}
      </p>
    );
  });
}

/** Renders AI markdown output inside a consistently spaced container. */
export function MarkdownBlock({ text, className = "space-y-1" }: { text: string; className?: string }) {
  // dir="auto" lets Hebrew (and other RTL) AI output render right-to-left per block.
  return (
    <div className={className} dir="auto">
      {renderMarkdown(text)}
    </div>
  );
}

export default MarkdownBlock;
