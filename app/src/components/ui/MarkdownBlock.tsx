import React from "react";
import { Sparkles } from "lucide-react";

/** Inline parser: bolds **text** segments, leaves the rest as plain text. */
export function parseInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-extrabold">
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
          className="text-sm font-bold text-[#f4d991] tracking-wider uppercase mt-5 mb-2 border-b border-white/5 pb-1 flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" />
          {content.replace("### ", "")}
        </h4>
      );
    }
    if (content.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base font-extrabold text-[#f7f1e7] mt-6 mb-3 tracking-tight">
          {content.replace("## ", "")}
        </h3>
      );
    }
    if (content.startsWith("- ") || content.startsWith("* ")) {
      const items = content.split(/\n[\-*]\s+/);
      return (
        <ul key={idx} className="list-disc pl-5 my-3 space-y-1.5 text-gray-300 text-sm">
          {items.map((item, i) => {
            const cleanItem = item.replace(/^[\-*]\s+/, "");
            return <li key={i}>{parseInline(cleanItem)}</li>;
          })}
        </ul>
      );
    }
    return (
      <p key={idx} className="text-gray-300 leading-relaxed text-sm mb-3.5">
        {parseInline(content)}
      </p>
    );
  });
}

/** Renders AI markdown output inside a consistently spaced container. */
export function MarkdownBlock({ text, className = "space-y-1" }: { text: string; className?: string }) {
  return <div className={className}>{renderMarkdown(text)}</div>;
}

export default MarkdownBlock;
