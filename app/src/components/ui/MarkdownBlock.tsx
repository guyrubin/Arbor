import React from "react";
import { HELPLINE_DIRECTORY } from "../../safety/escalation";

/* LC-01 — links that a parent in crisis can actually tap.
 *
 * Escalation copy (safety/escalation.ts) reaches the screen through this
 * renderer. Two link forms are honoured:
 *   1. explicit markdown links `[label](href)` where href is `tel:…`, an
 *      in-app hash route `#/…`, or an https URL;
 *   2. any BARE crisis number that matches a HELPLINE_DIRECTORY entry —
 *      autolinked to that entry's `tel:` target — so the `**112**` bolded in the
 *      resources copy becomes a call button without editing the copy.
 * Every tel/route anchor carries a ≥44px target. Anything else (unknown
 * schemes, javascript:, arbitrary numbers) renders as plain text. */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** Display number → dialable tel target, from the single crisis directory. */
const DIRECTORY_TEL = new Map(HELPLINE_DIRECTORY.map((h) => [h.number, h.tel]));

/** Longest-first so "0800-0113" wins over any shorter overlapping literal. */
const BARE_NUMBER_SRC = [...DIRECTORY_TEL.keys()]
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join("|");
const URL_SRC = "https?:\\/\\/[^\\s)]+";
/** Bare directory numbers are only linked as whole tokens — "1120" or "112b" never match. */
const AUTOLINK_RE = new RegExp(`(${URL_SRC})|(?<![\\w-])(${BARE_NUMBER_SRC})(?![\\w-])`, "g");
const MD_LINK_RE = /\[([^\]]+)\]\((tel:[+\d]+|#\/[\w-]*|https?:\/\/[^\s)]+)\)/g;

const TEL_CLS = "inline-flex items-center min-h-[44px] px-1.5 rounded-lg font-extrabold underline underline-offset-2 align-middle";
const ROUTE_CLS = "inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl font-extrabold no-underline";
const URL_CLS = "underline underline-offset-2 font-bold break-all";

function linkNode(href: string, label: string, key: React.Key) {
  if (href.startsWith("tel:")) {
    return (
      <a key={key} href={href} dir="ltr" className={TEL_CLS} style={{ color: "var(--arbor-pink-ink)" }}>
        {label}
      </a>
    );
  }
  if (href.startsWith("#/")) {
    return (
      <a key={key} href={href} className={ROUTE_CLS} style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
        {label}
      </a>
    );
  }
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={URL_CLS} style={{ color: "var(--arbor-sky-ink)" }}>
      {label}
    </a>
  );
}

/** Plain text → text with bare directory numbers + URLs turned into anchors. */
function autolink(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(AUTOLINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    if (m[1]) out.push(linkNode(m[1], m[1], `${keyBase}-u${n++}`));
    else out.push(linkNode(`tel:${DIRECTORY_TEL.get(m[2])}`, m[2], `${keyBase}-n${n++}`));
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Text → explicit markdown links honoured, remaining text autolinked. */
function parseLinks(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(MD_LINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(...autolink(text.slice(last, idx), `${keyBase}-t${n}`));
    out.push(linkNode(m[2], m[1], `${keyBase}-l${n++}`));
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(...autolink(text.slice(last), `${keyBase}-t${n}`));
  return out;
}

/** Inline parser: bolds **text** segments, links `[label](href)` and bare crisis numbers. */
export function parseInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>
          {parseLinks(part.slice(2, -2), `b${i}`)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{parseLinks(part, `p${i}`)}</React.Fragment>;
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
          className="text-[13px] font-bold mt-5 mb-1.5"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          {parseInline(content.replace("### ", ""))}
        </h4>
      );
    }
    if (content.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base font-semibold mt-6 mb-3 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {parseInline(content.replace("## ", ""))}
        </h3>
      );
    }
    if (content.startsWith("- ") || content.startsWith("* ")) {
      const items = content.split(/\n[\-*]\s+/);
      return (
        <ul key={idx} className="list-disc ps-5 my-3 space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
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
