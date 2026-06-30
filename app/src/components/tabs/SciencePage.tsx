import React, { useState } from "react";
import Icon from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";

/**
 * AP-060: "The Science" — parent-facing trust / source-transparency page.
 *
 * FIREWALL GATES (CHARTER §3 p11 — board-cleared 2026-06-23):
 *  - Hero copy is VERBATIM — do NOT paraphrase.
 *  - Disclaimer is VERBATIM — do NOT paraphrase.
 *  - Board-composition line is VERBATIM — do NOT paraphrase.
 *  - "clinical" MUST NOT modify board / review / validation / approval anywhere.
 *  - Developmental reviewers is the ONLY permitted internal-role label.
 *
 * STATIC EDITORIAL CONTENT — no child data read, captured, processed, or exported.
 *
 * // AP-060: ASQ-3 deep-link HELD pending legal/IP clearance — do not add an
 * // outbound link or reproduce any ASQ-3 items.
 */

// ─── Citation anchor data ──────────────────────────────────────────────────────
// Real, publicly verifiable URLs. NO ASQ-3 deep-link (held per above).
const CITATIONS = [
  {
    key: "cdc-ltsae",
    label: "CDC Learn the Signs. Act Early. (2022 revision)",
    url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
    note: "cdc_note",
  },
  {
    key: "aap-dev",
    label: "American Academy of Pediatrics — Developmental Surveillance & Screening",
    url: "https://www.aap.org/en/patient-care/developmental-surveillance-and-screening/",
    note: null,
  },
  {
    key: "asha",
    label: "American Speech-Language-Hearing Association — Speech and Language Development",
    url: "https://www.asha.org/public/speech/development/",
    note: null,
  },
  {
    key: "who-dev",
    label: "WHO — Child Development (Early Childhood Development)",
    url: "https://www.who.int/health-topics/child-development",
    note: null,
  },
  {
    key: "siegel-bryson",
    label: "Siegel & Bryson — The Whole-Brain Child (content informed by)",
    url: "https://www.drdansiegel.com/books/the-whole-brain-child/",
    note: "siegel_note",
  },
  {
    key: "gottman",
    label: "Gottman Institute — Raising An Emotionally Intelligent Child (content informed by; behavior & emotion-coaching surface)",
    url: "https://www.gottman.com/blog/raising-an-emotionally-intelligent-child/",
    note: "gottman_note",
  },
] as const;

// ─── Stat tiles ────────────────────────────────────────────────────────────────
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl p-5 text-center"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", minHeight: 100 }}
    >
      <span className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-clay)" }}>
        {value}
      </span>
      <span className="mt-1 text-xs font-semibold leading-snug" style={{ color: "var(--arbor-muted)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Citation row ──────────────────────────────────────────────────────────────
function CitationRow({ citation, noteText }: { citation: typeof CITATIONS[number]; noteText?: string }) {
  return (
    <li className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
      <Icon name="menu_book" size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--arbor-clay)" }} />
      <div className="flex-1 min-w-0">
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold leading-snug hover:underline focus-visible:underline inline-flex items-center gap-1 flex-wrap"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          {citation.label}
          <Icon name="open_in_new" size={12} className="flex-shrink-0" aria-label="(opens in new tab)" />
        </a>
        {noteText && (
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {noteText}
          </p>
        )}
      </div>
    </li>
  );
}

// ─── Expandable section ─────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start min-h-[44px] transition"
        style={{ background: open ? "var(--arbor-green-soft)" : "transparent" }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "var(--arbor-paper-deep)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <span className="flex items-center gap-2.5 font-bold text-sm" style={{ color: open ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>
          {icon}
          {title}
        </span>
        {open
          ? <Icon name="expand_less" size={16} className="flex-shrink-0" style={{ color: "var(--arbor-green-ink)" }} />
          : <Icon name="expand_more" size={16} className="flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SciencePage() {
  const { t, uiLang } = useLanguage();
  const isHe = uiLang === "he";
  const dir = isHe ? "rtl" : "ltr";

  // Resolved i18n strings
  const heroLine       = t("sci.hero.line");
  const disclaimer     = t("sci.disclaimer");
  const boardNote      = t("sci.board.note");
  const cdcNote        = t("sci.cdc.note");
  const siegelNote     = t("sci.siegel.note");
  const gottmanNote    = t("sci.gottman.note");

  const citationNotes: Record<string, string | undefined> = {
    cdc_note:    cdcNote,
    siegel_note: siegelNote,
    gottman_note: gottmanNote,
  };

  return (
    <div dir={dir} className="max-w-2xl mx-auto space-y-6 pb-12" data-testid="science-page">

      {/* ── Eyebrow ───────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: "var(--arbor-clay)" }}>
          {t("sci.eyebrow")}
        </p>
        <h1 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("sci.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("sci.subtitle")}
        </p>
      </div>

      {/* ── FIREWALL: Approved disclaimer — VERBATIM, above the fold ─────── */}
      {/* AP-060 gate: this disclaimer text is VERBATIM and must render on load (not behind a toggle). */}
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.22)" }}
        role="note"
        aria-label={t("sci.disclaimer.aria")}
        data-testid="science-disclaimer"
      >
        <Icon name="verified_user" size={20} className="flex-shrink-0 mt-0.5" style={{ color: "var(--arbor-green-ink)" }} />
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-green-ink)" }}>
          {disclaimer}
        </p>
      </div>

      {/* ── FIREWALL: Hero card — VERBATIM developmentally-informed line ──── */}
      {/* AP-060 gate: hero line must be the cleared "Developmentally informed" copy. */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
        data-testid="science-hero-card"
      >
        <p
          className="text-base font-bold leading-snug"
          style={{ color: "var(--arbor-ink)" }}
          data-testid="science-hero-line"
        >
          {heroLine}
        </p>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile value="133" label={t("sci.stat.milestones")} />
        <StatTile value="7"   label={t("sci.stat.domains")} />
        <StatTile value="40+" label={t("sci.stat.sources")} />
      </div>

      {/* ── CDC framing ───────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
          {t("sci.cdc.framework")}
        </p>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("sci.cdc.ltsae.note")}
        </p>
      </div>

      {/* ── Framework sources ─────────────────────────────────────────────── */}
      <Section icon={<Icon name="menu_book" size={16} />} title={t("sci.sources.title")} defaultOpen>
        <ul className="mt-1 divide-y divide-transparent" role="list" aria-label={t("sci.sources.aria")}>
          {CITATIONS.map((c) => (
            <CitationRow
              key={c.key}
              citation={c}
              noteText={c.note ? citationNotes[c.note] : undefined}
            />
          ))}
        </ul>
        {/* AP-060: ASQ-3 deep-link HELD pending legal/IP clearance — do not add an outbound link or reproduce any ASQ-3 items. */}
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("sci.asq3.mention")}
        </p>
      </Section>

      {/* ── How we built it ───────────────────────────────────────────────── */}
      <Section icon={<Icon name="biotech" size={16} />} title={t("sci.howbuilt.title")}>
        <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--arbor-muted)" }}>
          {t("sci.howbuilt.body")}
        </p>
      </Section>

      {/* ── FIREWALL: Board-composition line — VERBATIM ───────────────────── */}
      {/* AP-060 gate: board note must use the cleared "internal developmental reviewers /
          not licensed clinicians" copy. "clinical" MUST NOT modify board/review/validation/approval. */}
      <Section icon={<Icon name="group" size={16} />} title={t("sci.board.title")} data-testid="science-board-section">
        <p
          className="text-sm leading-relaxed mt-2"
          style={{ color: "var(--arbor-muted)" }}
          data-testid="science-board-note"
        >
          {boardNote}
        </p>
      </Section>

    </div>
  );
}
