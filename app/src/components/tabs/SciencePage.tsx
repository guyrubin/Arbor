import React, { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { track } from "../../lib/analytics";
import { SectionCard, Chip, IconBadge } from "../ui/kit";
import { SpineRibbon } from "../ui/SpineRibbon";
import { trustText } from "../../lib/i18nElevation/trustcenter";

/**
 * Trust Center — masterplan 3.3 + 3.4 + 3.1 (Maytal Row-2, all six frames).
 * Rebuild of AP-060 "The Science" (#/science) as ONE trust hub with six
 * sections: how Arbor works · what data it uses · what each sign means ·
 * what Arbor does NOT do · where the information comes from · questions &
 * contact. Every inline why-line across Arbor links here (TrustLink chip).
 *
 * FIREWALL GATES (CHARTER §3 p11 — board-cleared 2026-06-23, still binding):
 *  - Hero copy is VERBATIM — do NOT paraphrase. (Renders as section 5's lead.)
 *  - Disclaimer is VERBATIM — do NOT paraphrase; renders on load, above the fold.
 *  - Board-composition line is VERBATIM — do NOT paraphrase.
 *  - "clinical" MUST NOT modify board / review / validation / approval anywhere.
 *  - Developmental reviewers is the ONLY permitted internal-role label.
 *  - Legend explains ARBOR'S actual marks (counts, "worth a conversation",
 *    provenance, cumulative moments) — a traffic-light tier does not exist
 *    in-product and must not be invented here. The X-list renders with MUTED
 *    close glyphs, never alarm colors.
 *
 * GD-10 fail-closed: no named-reviewer claims — see the commented seam in the
 * sources section.
 *
 * STATIC EDITORIAL CONTENT — no child data read, captured, processed, or exported.
 *
 * // AP-060: ASQ-3 deep-link HELD pending legal/IP clearance — do not add an
 * // outbound link or reproduce any ASQ-3 items.
 */

// ─── Citation anchor data (preserved verbatim from AP-060) ────────────────────
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

// ─── Section registry (ids double as analytics ids + DOM anchors) ─────────────
const SECTION_IDS = ["how", "data", "signs", "not", "sources", "more"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_ICON: Record<SectionId, string> = {
  how: "route",
  data: "database",
  signs: "label",
  not: "block",
  sources: "menu_book",
  more: "forum",
};

// ─── Small preserved pieces (AP-060) ──────────────────────────────────────────
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

function CitationRow({ citation, noteText }: { citation: (typeof CITATIONS)[number]; noteText?: string }) {
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

// ─── Trust-center building blocks ──────────────────────────────────────────────
/** Legend row: the actual in-product mark (soft chip) + what it means. */
function LegendRow({ chip, label, desc }: { chip: React.ReactNode; label: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
      <span className="flex-shrink-0 mt-0.5">{chip}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{desc}</p>
      </div>
    </li>
  );
}

/** X-list row — muted close glyph on neutral paper, NEVER an alarm color. */
function NotRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 28, height: 28, background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
      >
        <Icon name="close" size={15} weight={600} />
      </span>
      <p className="text-sm leading-relaxed pt-1" style={{ color: "var(--arbor-ink)" }}>{text}</p>
    </li>
  );
}

/** Collapsed-by-default FAQ row (44px hit target, aria-expanded). */
function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--arbor-rule)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start min-h-[44px]"
        style={{ background: open ? "var(--arbor-lav-soft)" : "transparent" }}
      >
        <span className="text-sm font-bold" style={{ color: open ? "var(--arbor-lav-ink)" : "var(--arbor-ink)" }}>{q}</span>
        <Icon name={open ? "expand_less" : "expand_more"} size={16} className="flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
      </button>
      {open && (
        <p className="px-4 pb-3 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{a}</p>
      )}
    </div>
  );
}

/** Tappable deep-link row (→ Profile data controls, → Consult). */
function LinkRow({ icon, label, sub, onGo, testId }: { icon: string; label: string; sub?: string; onGo: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onGo}
      data-testid={testId}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[44px] text-start transition active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none"
      style={{ background: "var(--arbor-lav-soft)", border: "1px solid var(--arbor-rule)" }}
    >
      <IconBadge tone="lav" size={36}><Icon name={icon} size={18} /></IconBadge>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold" style={{ color: "var(--arbor-lav-ink)" }}>{label}</span>
        {sub && <span className="block text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{sub}</span>}
      </span>
      <Icon name="arrow_forward" size={16} className="flex-shrink-0 rtl:rotate-180" style={{ color: "var(--arbor-lav-ink)" }} />
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SciencePage() {
  const { t, uiLang } = useLanguage();
  const { setActiveTab } = useArbor();
  const isHe = uiLang === "he";
  const dir = isHe ? "rtl" : "ltr";
  /** Module-local resolver (same recipe as Screening.tsx × screeningcalm). */
  const tt = (key: string, vars?: Record<string, string | number>) => trustText(uiLang, key, vars);

  // trustcenter_open — once per mount (ref-guarded, PromiseCard pattern).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("trustcenter_open");
  }, []);

  /** Hub row tap: analytics + scroll to the section (motion-safe). */
  const goSection = (id: SectionId) => {
    track("trustcenter_section", { id });
    const el = document.getElementById(`trust-${id}`);
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  // Resolved verbatim strings (sci.* keys stay in lib/i18n — AP-060 canon).
  const disclaimer = t("sci.disclaimer");
  const heroLine = t("sci.hero.line");
  const boardNote = t("sci.board.note");
  const citationNotes: Record<string, string | undefined> = {
    cdc_note: t("sci.cdc.note"),
    siegel_note: t("sci.siegel.note"),
    gottman_note: t("sci.gottman.note"),
  };

  return (
    <div dir={dir} className="max-w-2xl mx-auto space-y-6 pb-12" data-testid="science-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {tt("elev.trust.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {tt("elev.trust.subtitle")}
        </p>
      </div>

      {/* ── Spine — masterplan 1.5/3.3: the trust center is a spine surface. ── */}
      <SpineRibbon text={tt("elev.trust.spine")} tone="lav" icon="hub" testId="trust-spine-ribbon" />

      {/* ── FIREWALL: Approved disclaimer — VERBATIM, renders on load ───────── */}
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

      {/* ── Hub quick-nav (Maytal frame 6: one listing, each row → section) ── */}
      <nav aria-label={tt("elev.trust.title")} className="flex flex-wrap gap-2" data-testid="trust-hub-nav">
        {SECTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => goSection(id)}
            data-testid={`trust-nav-${id}`}
            className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--t-xs)] font-bold transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none before:absolute before:content-[''] before:-inset-y-2 before:inset-x-0"
            style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}
          >
            <Icon name={SECTION_ICON[id]} size={14} />
            {tt(`elev.trust.nav.${id}`)}
          </button>
        ))}
      </nav>

      {/* ── 1 · How Arbor works (Maytal frame 2) ────────────────────────────── */}
      <div id="trust-how" data-testid="trust-section-how" className="scroll-mt-4">
        <SectionCard title={tt("elev.trust.how.title")} icon={<Icon name={SECTION_ICON.how} size={18} />} tone="lav">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {tt("elev.trust.how.body")}
          </p>
          <p className="mt-4 mb-2 text-xs font-extrabold" style={{ color: "var(--arbor-muted)" }}>
            {tt("elev.trust.how.uses.title")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip tone="lav" icon={<Icon name="cake" size={13} />}>{tt("elev.trust.how.uses.age")}</Chip>
            <Chip tone="lav" icon={<Icon name="edit_note" size={13} />}>{tt("elev.trust.how.uses.shared")}</Chip>
            <Chip tone="lav" icon={<Icon name="sports_esports" size={13} />}>{tt("elev.trust.how.uses.activities")}</Chip>
            <Chip tone="lav" icon={<Icon name="checklist" size={13} />}>{tt("elev.trust.how.uses.screening")}</Chip>
            <Chip tone="lav" icon={<Icon name="menu_book" size={13} />}>{tt("elev.trust.how.uses.base")}</Chip>
          </div>
          {/* The ONE lock line — Maytal frame 2, HE verbatim. */}
          <div
            className="mt-4 rounded-2xl px-4 py-3 flex items-center gap-2.5"
            style={{ background: "var(--arbor-green-soft)" }}
            data-testid="trust-lock-line"
          >
            <Icon name="lock" size={16} fill={1} style={{ color: "var(--arbor-green-ink)" }} />
            <p className="text-sm font-bold leading-snug" style={{ color: "var(--arbor-green-ink)" }}>
              {tt("elev.trust.how.lock")}
            </p>
          </div>
        </SectionCard>
      </div>

      {/* ── 2 · What data Arbor collects and uses ───────────────────────────── */}
      <div id="trust-data" data-testid="trust-section-data" className="scroll-mt-4">
        <SectionCard title={tt("elev.trust.data.title")} icon={<Icon name={SECTION_ICON.data} size={18} />} tone="lav">
          <ul role="list">
            {(["profile", "moments", "play", "screening", "coach"] as const).map((row) => (
              <LegendRow
                key={row}
                chip={<IconBadge tone="lav" size={32}><Icon name={{ profile: "person", moments: "edit_note", play: "sports_esports", screening: "checklist", coach: "forum" }[row]} size={16} /></IconBadge>}
                label={tt(`elev.trust.data.${row}.label`)}
                desc={tt(`elev.trust.data.${row}.desc`)}
              />
            ))}
          </ul>
          <p className="mt-3 mb-2 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {tt("elev.trust.data.manage")}
          </p>
          <LinkRow
            icon="settings_account_box"
            label={tt("elev.trust.data.manageCta")}
            onGo={() => setActiveTab("profile")}
            testId="trust-manage-data"
          />
        </SectionCard>
      </div>

      {/* ── 3 · What each sign means — legend of ARBOR'S actual marks ───────── */}
      <div id="trust-signs" data-testid="trust-section-signs" className="scroll-mt-4">
        <SectionCard title={tt("elev.trust.signs.title")} icon={<Icon name={SECTION_ICON.signs} size={18} />} tone="lav">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {tt("elev.trust.signs.intro")}
          </p>
          <ul role="list" className="mt-1">
            <LegendRow
              chip={<Chip tone="mint" icon={<Icon name="check" size={13} />}>{tt("elev.trust.signs.check.label")}</Chip>}
              label={tt("elev.trust.signs.check.label")}
              desc={tt("elev.trust.signs.check.desc")}
            />
            <LegendRow
              chip={<Chip tone="lav" icon={<Icon name="forum" size={13} />}>{tt("elev.trust.signs.flag.label")}</Chip>}
              label={tt("elev.trust.signs.flag.label")}
              desc={tt("elev.trust.signs.flag.desc")}
            />
            <LegendRow
              chip={<Chip tone="sky" icon={<Icon name="person" size={13} />}>{tt("elev.trust.signs.prov.label")}</Chip>}
              label={tt("elev.trust.signs.prov.label")}
              desc={tt("elev.trust.signs.prov.desc")}
            />
            <LegendRow
              chip={<Chip tone="lav" icon={<Icon name="photo_library" size={13} />}>{tt("elev.trust.signs.count.label")}</Chip>}
              label={tt("elev.trust.signs.count.label")}
              desc={tt("elev.trust.signs.count.desc")}
            />
          </ul>
          {/* Honest uncertainty — ranges + "typical for this age", never point claims. */}
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {tt("elev.trust.signs.ranges")}
          </p>
          {/* The explicit negation line (allowlisted .never key). */}
          <p className="mt-3 rounded-2xl px-4 py-3 text-sm font-bold leading-relaxed" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }} data-testid="trust-never-line">
            {tt("elev.trust.signs.never")}
          </p>
        </SectionCard>
      </div>

      {/* ── 4 · What Arbor does NOT do (Maytal frame 4 — muted X-list) ──────── */}
      <div id="trust-not" data-testid="trust-section-not" className="scroll-mt-4">
        <SectionCard title={tt("elev.trust.not.title")} icon={<Icon name={SECTION_ICON.not} size={18} />} tone="lav">
          <ul role="list">
            <NotRow text={tt("elev.trust.not.diagnosis")} />
            <NotRow text={tt("elev.trust.not.substitute")} />
            <NotRow text={tt("elev.trust.not.medical")} />
            <NotRow text={tt("elev.trust.not.sell")} />
          </ul>
        </SectionCard>
      </div>

      {/* ── 5 · Where the information comes from (AP-060 content, restructured) */}
      <div id="trust-sources" data-testid="trust-section-sources" className="scroll-mt-4">
        <SectionCard title={tt("elev.trust.sources.title")} icon={<Icon name={SECTION_ICON.sources} size={18} />} tone="lav">
          {/* FIREWALL: hero line — VERBATIM "Developmentally informed" copy. */}
          <p className="text-base font-bold leading-snug" style={{ color: "var(--arbor-ink)" }} data-testid="science-hero-line">
            {heroLine}
          </p>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <StatTile value="133" label={t("sci.stat.milestones")} />
            <StatTile value="7" label={t("sci.stat.domains")} />
            <StatTile value="40+" label={t("sci.stat.sources")} />
          </div>

          <div className="rounded-2xl p-4 mt-4" style={{ background: "var(--arbor-paper-deep)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {t("sci.cdc.framework")}
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {t("sci.cdc.ltsae.note")}
            </p>
          </div>

          <ul className="mt-2 divide-y divide-transparent" role="list" aria-label={t("sci.sources.aria")}>
            {CITATIONS.map((c) => (
              <CitationRow key={c.key} citation={c} noteText={c.note ? citationNotes[c.note] : undefined} />
            ))}
          </ul>
          {/* AP-060: ASQ-3 deep-link HELD pending legal/IP clearance — do not add an outbound link or reproduce any ASQ-3 items. */}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("sci.asq3.mention")}
          </p>

          {/*
            GD-10 SEAM — fail-closed. A "Reviewed by [name]" citation row goes
            HERE, and ONLY after Guy appoints a named reviewer (masterplan 3.4;
            Maytal frame 5's "expert team" row is deliberately omitted until
            then). Until that gate opens, the only internal-role language on
            this page is the verbatim board note below.
          */}

          {/* FIREWALL: board-composition line — VERBATIM. "clinical" MUST NOT
              modify board/review/validation/approval. */}
          <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)" }} data-testid="science-board-section">
            <p className="text-xs font-extrabold mb-1" style={{ color: "var(--arbor-muted)" }}>{t("sci.board.title")}</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }} data-testid="science-board-note">
              {boardNote}
            </p>
          </div>
        </SectionCard>
      </div>

      {/* ── 6 · Questions & contact ─────────────────────────────────────────── */}
      <div id="trust-more" data-testid="trust-section-more" className="scroll-mt-4">
        <SectionCard title={tt("elev.trust.more.title")} icon={<Icon name={SECTION_ICON.more} size={18} />} tone="lav">
          <div className="space-y-2">
            <FaqRow q={tt("elev.trust.more.faq1.q")} a={tt("elev.trust.more.faq1.a")} />
            <FaqRow q={tt("elev.trust.more.faq2.q")} a={tt("elev.trust.more.faq2.a")} />
            <FaqRow q={tt("elev.trust.more.faq3.q")} a={tt("elev.trust.more.faq3.a")} />
          </div>
          {/* Privacy-policy row deliberately absent: no policy route exists in
              ROUTE_IDS today — data controls live in Profile (linked in §2). */}
          <div className="mt-3">
            <LinkRow
              icon="support_agent"
              label={tt("elev.trust.more.contact")}
              sub={tt("elev.trust.more.contactSub")}
              onGo={() => setActiveTab("consult")}
              testId="trust-contact-consult"
            />
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
