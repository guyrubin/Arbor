import React, { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../../context/LanguageContext";

/* B-STATUS-01 — every action answers back: ONE feedback grammar for parent mode.
 *
 * RECEIPT. One line in the past tense that says where the thing went ("Noted
 * on Dylan's Words shelf."), with a link to it ("Open") and, when the write
 * can be reversed, "Undo" — "Kept on Words · Open · Undo". It replaces the
 * receipt markup each loop card drew for itself (PracticeCard, NoticeCard,
 * TonightFlow, MilestoneProposalRow) and the capture sheet's confirm line,
 * without changing what any of them says. Toasts stay for errors and undo
 * only; lib/toastRatchet.guard.test.ts holds every other toast call site to a
 * shrink-only baseline.
 *
 * ANNOUNCED through ONE polite live region. A live region inserted together
 * with its text is not reliably read (screen readers announce a change INSIDE
 * a region that already exists), so the line itself carries no live role: on
 * mount it hands its words to a single polite region that lives on <body> for
 * the session (announcePolite) — exempt from the dialog shield, so a receipt
 * inside the capture sheet is read too. Nothing is read twice. A receipt drawn
 * for an EARLIER answer (`announce={false}`) is shown, not announced.
 *
 * PENDING. AI work answers with ONE quiet line after 400 ms (PendingLine):
 * never a spinner wall, never a flash — work that settles sooner shows nothing.
 *
 * Parent register: tokens only, logical properties, no upper case, no letter
 * spacing, no text under 12 px, no 800/900 weights, no gradient. The line
 * takes its direction from the page language (an <Icon> ligature leading a
 * dir="auto" line would resolve a Hebrew receipt LTR — bidiIconLead.guard).
 */

/** No pending line, and no flash, for AI work that settles sooner than this. */
export const PENDING_DELAY_MS = 400;

export type ReceiptTone = "muted" | "soft" | "ink" | "kept";

export interface ReceiptLink {
  /** The place the thing went, named in the link's accessible label ("Open Words"). */
  where: string;
  /** A hash route (`#/journal?shelf=words`) — a real link. */
  href: string;
  /** Runs before the hash moves (the capture sheet closes itself). */
  onOpen?: () => void;
  testId?: string;
}

export interface ReceiptUndo {
  label: string;
  onUndo: () => void;
  testId?: string;
  disabled?: boolean;
}

export interface ReceiptProps {
  /** The past-tense line, already in the page language. */
  children: React.ReactNode;
  testId?: string;
  /** Extra data-* attributes on the line (e.g. `data-beside`). */
  data?: Record<string, string>;
  /** A Material Symbols glyph name; null draws none. */
  icon?: string | null;
  /** muted (default) · soft · ink · kept (the one green "kept" pill). */
  tone?: ReceiptTone;
  size?: "sm" | "base";
  /** The capture sheet's lead line: the same receipt, in bold. */
  strong?: boolean;
  link?: ReceiptLink | null;
  undo?: ReceiptUndo | null;
  /** false: a receipt for an answer given EARLIER — drawn, not announced. */
  announce?: boolean;
  /** The words announced; defaults to the line's own text. */
  announceText?: string;
  className?: string;
}

const TONE_STYLE: Record<ReceiptTone, React.CSSProperties> = {
  muted: { color: "var(--arbor-muted)" },
  soft: { color: "var(--arbor-ink-soft)" },
  ink: { color: "var(--arbor-ink)" },
  kept: { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" },
};

const TRAILING = "inline-flex min-h-[44px] min-w-[44px] flex-none items-center justify-center rounded-full px-3 t-sm font-semibold";

/** The plain words of a receipt line (what the live region reads). */
export function receiptText(node: React.ReactNode): string {
  const walk = (n: React.ReactNode): string => {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string" || typeof n === "number") return String(n);
    if (Array.isArray(n)) return n.map(walk).join("");
    if (React.isValidElement(n)) return walk((n.props as { children?: React.ReactNode }).children);
    return "";
  };
  return walk(node).replace(/\s+/g, " ").trim();
}

let region: HTMLElement | null = null;
let fillTimer: ReturnType<typeof setTimeout> | null = null;

/** The words go to ONE polite region on <body> (created on first use, kept for
 *  the session, exempt from the dialog shield). Cleared first and filled on
 *  the next turn, so the same words twice in a row are read twice. `doc` is a
 *  seam for tests; outside a browser this does nothing. */
export function announcePolite(text: string, doc: Document | undefined = typeof document === "undefined" ? undefined : document): void {
  const words = text.replace(/\s+/g, " ").trim();
  if (!doc || !words) return;
  if (!region || region.ownerDocument !== doc || !region.isConnected) {
    const el = doc.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.setAttribute("data-receipt-announcer", "");
    el.setAttribute("data-dialog-shield-exempt", "");
    el.className = "sr-only";
    doc.body.appendChild(el);
    region = el;
  }
  const target = region;
  target.textContent = "";
  if (fillTimer) clearTimeout(fillTimer);
  fillTimer = setTimeout(() => {
    target.textContent = words;
    fillTimer = null;
  }, 50);
}

/** The pending clock: `onShow` fires once the work has lasted `delayMs`; the
 *  returned cancel stops it, so work that settles sooner shows nothing. */
export function startPendingClock(onShow: () => void, delayMs: number = PENDING_DELAY_MS): () => void {
  const timer = setTimeout(onShow, delayMs);
  return () => clearTimeout(timer);
}

/** True once `active` has held for `delayMs` (false again the moment it ends). */
export function usePendingAfter(active: boolean, delayMs: number = PENDING_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    if (!active) return undefined;
    return startPendingClock(() => setShown(true), delayMs);
  }, [active, delayMs]);
  return active && shown;
}

/** The ONE pending pattern for AI work: a quiet muted line after 400 ms.
 *  `className` replaces the default type classes (a host's own status class). */
export function PendingLine({ active, children, testId = "pending-line", className, announceText }: {
  active: boolean;
  children: React.ReactNode;
  testId?: string;
  className?: string;
  announceText?: string;
}) {
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const shown = usePendingAfter(active);
  const spoken = announceText ?? receiptText(children);
  useEffect(() => {
    if (shown && spoken) announcePolite(spoken);
  }, [shown, spoken]);
  if (!shown) return null;
  return (
    <p
      data-testid={testId}
      data-pending=""
      dir={lang === "he" ? "rtl" : "ltr"}
      lang={lang}
      // A host's own status class (Now's .now-inline-status) replaces the default type.
      className={className ?? "t-sm leading-snug"}
      style={{ color: "var(--arbor-muted)" }}
    >
      {children}
    </p>
  );
}

/** The ONE receipt line (see the file header). */
export function Receipt({
  children,
  testId,
  data,
  icon = "check",
  tone = "muted",
  size = "base",
  strong = false,
  link,
  undo,
  announce = true,
  announceText,
  className,
}: ReceiptProps) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const spoken = announceText ?? receiptText(children);
  useEffect(() => {
    if (announce && spoken) announcePolite(spoken);
  }, [announce, spoken]);
  const sizeCls = size === "sm" ? "t-sm" : "t-base";
  const kept = tone === "kept";
  const line = (
    <p
      data-testid={testId}
      {...(data ?? {})}
      data-receipt={tone}
      dir={lang === "he" ? "rtl" : "ltr"}
      lang={lang}
      className={kept
        ? `inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 ${sizeCls} font-semibold`
        : `min-w-0 ${sizeCls} leading-snug${strong ? " font-bold" : ""}`}
      style={TONE_STYLE[tone]}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} className={kept ? undefined : "me-1 inline-block align-[-3px]"} />}
      {children}
    </p>
  );
  if (!link && !undo) return className ? <div className={className}>{line}</div> : line;
  return (
    <div data-receipt-row="" className={`flex items-center gap-2${className ? ` ${className}` : ""}`}>
      {line}
      {link && (
        <a
          href={link.href}
          onClick={link.onOpen}
          data-testid={link.testId ?? "receipt-open"}
          aria-label={t("elev.loop.receipt.openAria", { where: link.where })}
          className={`ms-auto ${TRAILING}`}
          style={{ color: "var(--arbor-clay)" }}
        >
          {t("elev.loop.receipt.open")}
        </a>
      )}
      {undo && (
        <button
          type="button"
          data-testid={undo.testId}
          onClick={undo.onUndo}
          disabled={undo.disabled}
          className={`${link ? "" : "ms-auto "}${TRAILING}`}
          style={{ color: "var(--arbor-clay)" }}
        >
          {undo.label}
        </button>
      )}
    </div>
  );
}

export default Receipt;
