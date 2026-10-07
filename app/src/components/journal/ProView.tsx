import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { DOMAINS, domainName, type DomainId } from "../../lib/domains/registry";
import { shelfLabel, shelvesOfDomain } from "../../lib/shelves/registry";
import { intakeLabelKey, professionLabelKey } from "../../lib/i18nElevation/professions";
import { DEMO_HEADER_KEY, INTAKE_PROFESSIONS, intakeDay, type ConsultPacket, type IntakeProfession } from "../../consult/packet";
import type { ProDomainCounts } from "../../lib/journal/shelfView";

export type ProEgressVerb = "pdf" | "copy" | "send";

export interface ProViewProps {
  childName: string;
  profession: IntakeProfession;
  onSelectProfession: (p: IntakeProfession) => void;
  /** buildIntakePacket(profession), in the page language. */
  packet: ConsultPacket;
  /** The parent's questions for this professional, as typed (one per line). */
  questions: string;
  onQuestionsChange: (text: string) => void;
  /** PDF · Copy · Send go through the ONE consult step-3 egress (the reviewed gate). */
  onEgress: (verb: ProEgressVerb) => void;
  /** Per-domain counts (counts only). */
  counts: ReadonlyMap<string, ProDomainCounts>;
  onBack: () => void;
  /** TimelineTab's ONE stamp literal — on this view it rides on the packet's first verb. */
  primaryMoveProps?: Record<string, string>;
}

/** The packet's five labelled lines, in the order an intake reads them. */
const PACKET_LINES: { section: string; labelKey: string }[] = [
  { section: "intake-seen", labelKey: "elev.shelfJournal.pro.line.seen" },
  { section: "intake-not-yet", labelKey: "elev.shelfJournal.pro.line.notYet" },
  { section: "intake-moments", labelKey: "elev.shelfJournal.pro.line.moments" },
  { section: "intake-practice", labelKey: "elev.shelfJournal.pro.line.practice" },
];

const CARD: React.CSSProperties = {
  background: "var(--arbor-paper-elevated)",
  border: "1px solid var(--arbor-rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-xs)",
};

/** "{n} noticed · {m} milestones seen · {k} practice days" — zero parts left out; all zero → one quiet line. */
export function proCountsLine(c: ProDomainCounts | undefined, t: (k: string, v?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  if (c?.noticed) parts.push(t(c.noticed === 1 ? "elev.loop.shelf.noticed.one" : "elev.loop.shelf.noticed", { n: c.noticed }));
  if (c?.milestonesSeen) parts.push(t(c.milestonesSeen === 1 ? "elev.shelfJournal.pro.count.milestones.one" : "elev.shelfJournal.pro.count.milestones", { n: c.milestonesSeen }));
  if (c?.practiceDays) parts.push(t(c.practiceDays === 1 ? "elev.shelfJournal.pro.count.practice.one" : "elev.shelfJournal.pro.count.practice", { n: c.practiceDays }));
  return parts.length ? parts.join(" · ") : t("elev.shelfJournal.pro.count.none");
}

/**
 * B-LOOP-12 — the professional view (`#/journal?view=pro`, same route).
 * Design of record: art/mockups/journal-shelves.html, phone 3. The back link
 * to the parent view is the FIRST control; the display H1; the pale-blue
 * note (professions are shown so the parent can prepare, never as an
 * assessment); "Prepare a packet for" chips (selected = navy fill); the
 * intake packet as labelled lines (Seen · Not seen yet · Moments · Practice
 * · Your questions) with PDF · Copy · Send — which open the ONE consult
 * step-3 egress (the reviewed gate stays); then the eight domain sections in
 * registry order: domain name + shelf names, the owning professions as
 * text, the counts line.
 *
 * FIREWALL: counts only; no verdict, no gap flagged, no age except the
 * sourced line inside "Not seen yet" (milestoneAgeLine, via the packet).
 * Professions render as text ONLY here and in Care (ProView.test grep pin).
 */
export default function ProView({
  childName,
  profession,
  onSelectProfession,
  packet,
  questions,
  onQuestionsChange,
  onEgress,
  counts,
  onBack,
  primaryMoveProps,
}: ProViewProps) {
  const { t, uiLang } = useLanguage();
  const sectionItems = (id: string) => packet.sections.find((s) => s.id === id)?.items ?? [];
  // P5-LOOP c2 r1 (journal product P1, G0): each packet line folds to 3 items
  // under ONE "Show all", so the packet's verbs — moved under its title — sit
  // above the fold at 375 (they were at y 920 / 961 under the full lists).
  const FOLD = 3;
  const [expanded, setExpanded] = useState(false);
  const folds = PACKET_LINES.some(({ section }) => sectionItems(section).length > FOLD);
  const professionName = t(intakeLabelKey(profession));
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-4">
      <header data-module="pro-header" className="min-w-0">
        <button
          type="button"
          data-testid="pro-back"
          onClick={onBack}
          className="-ms-1 inline-flex min-h-11 items-center gap-1 px-1 t-sm font-bold focus:outline-none focus-visible:ring-2"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name="arrow_back" size={18} aria-hidden className="rtl:-scale-x-100" />
          {t("elev.shelfJournal.pro.back")}
        </button>
        <h1 className="mt-1 t-2xl leading-tight tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("elev.shelfJournal.pro.h1", { name: childName })}
        </h1>
        <p data-testid="pro-note" className="mt-3 flex gap-2.5 px-3.5 py-3 t-sm leading-relaxed" style={{ background: "var(--arbor-paper-deep)", borderRadius: "var(--r)", color: "var(--arbor-ink-soft)" }}>
          <Icon name="info" size={18} aria-hidden className="flex-none" style={{ color: "var(--arbor-sky-ink)" }} />
          <span>{t("elev.shelfJournal.pro.note")}</span>
        </p>
      </header>

      <section data-module="pro-packet" className="flex min-w-0 flex-col gap-3" aria-labelledby="pro-packet-title">
        <p id="pro-prepare" className="t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.pro.prepare")}</p>
        <div role="radiogroup" aria-labelledby="pro-prepare" data-testid="pro-chips" className="flex flex-wrap gap-1.5">
          {INTAKE_PROFESSIONS.map((p) => {
            const on = p === profession;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                data-profession={p}
                onClick={() => onSelectProfession(p)}
                className="inline-flex min-h-11 items-center rounded-full px-3.5 t-sm font-bold transition"
                style={on
                  ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)", border: "1px solid var(--arbor-subtab-active)" }
                  : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
              >
                {t(intakeLabelKey(p))}
              </button>
            );
          })}
        </div>

        <article data-testid="pro-packet" className="p-4" style={CARD}>
          <h2 id="pro-packet-title" className="t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.shelfJournal.pro.packetTitle", { profession: professionName })}
          </h2>
          <p data-testid="pro-packet-prepared" className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>
            {/* c2 r2 (P2-5 + G1-3): ONE date format (the locale day, as every
                packet line), and the home languages named for the reader. */}
            {t("elev.packet.prepared", { date: intakeDay(`${packet.generatedAt}T12:00:00`, uiLang === "he" ? "he" : "en") || packet.generatedAt })}
            {packet.languages?.length ? <> · <span data-testid="pro-packet-languages">{t("elev.packet.intake.languages", { languages: packet.languages.join(", ") })}</span></> : null}
            {packet.demo ? <> · <span data-testid="pro-packet-demo">{t(DEMO_HEADER_KEY)}</span></> : null}
          </p>
          <div data-testid="pro-packet-actions" className="mt-3 flex gap-2">
            {(["pdf", "copy", "send"] as const).map((verb, i) => (
              <button
                key={verb}
                type="button"
                data-testid={`pro-egress-${verb}`}
                onClick={() => onEgress(verb)}
                {...(i === 0 ? primaryMoveProps ?? {} : {})}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 t-sm font-bold"
                style={i === 0
                  ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }
                  : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
              >
                <Icon name={verb === "pdf" ? "description" : verb === "copy" ? "content_copy" : "send"} size={17} aria-hidden />
                {t(`elev.shelfJournal.pro.${verb}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.pro.egressHint")}</p>
          <dl className="mt-2">
            {PACKET_LINES.map(({ section, labelKey }) => {
              const items = sectionItems(section);
              return (
                <div key={section} data-testid="pro-packet-line" data-section={section} className="flex gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
                  <dt className="w-24 flex-none pt-0.5 t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{t(labelKey)}</dt>
                  <dd className="min-w-0 flex-1 t-sm leading-relaxed" style={{ color: items.length ? "var(--arbor-ink-soft)" : "var(--arbor-muted)" }}>
                    {items.length
                      ? (expanded ? items : items.slice(0, FOLD)).map((it) => <span key={it.id} className="block"><bdi dir="auto">{it.text}</bdi></span>)
                      : t("elev.shelfJournal.pro.line.none")}
                  </dd>
                </div>
              );
            })}
            {folds && (
              <div className="border-t py-1" style={{ borderColor: "var(--arbor-rule)" }}>
                <button
                  type="button"
                  data-testid="pro-packet-show-all"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex min-h-11 items-center gap-1 t-sm font-bold underline underline-offset-4"
                  style={{ color: "var(--arbor-clay)" }}
                >
                  {t(expanded ? "elev.shelfJournal.pro.showFewer" : "elev.shelfJournal.pro.showAll")}
                </button>
              </div>
            )}
            <div data-testid="pro-packet-line" data-section="intake-questions" className="flex gap-3 border-t py-2" style={{ borderColor: "var(--arbor-rule)" }}>
              <dt className="w-24 flex-none pt-0.5 t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
                <label htmlFor="pro-questions">{t("elev.shelfJournal.pro.line.questions")}</label>
              </dt>
              <dd className="min-w-0 flex-1">
                <textarea
                  id="pro-questions"
                  data-testid="pro-questions"
                  value={questions}
                  onChange={(e) => onQuestionsChange(e.target.value)}
                  placeholder={t("elev.shelfJournal.pro.questions.placeholder")}
                  dir="auto"
                  rows={2}
                  className="field-bare min-h-11 w-full resize-y t-sm leading-relaxed focus:outline-none"
                  style={{ color: "var(--arbor-ink)" }}
                />
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section data-module="pro-domains" aria-label={t("elev.shelfJournal.pro.domainsAria")} className="px-4 py-1" style={CARD}>
        {DOMAINS.map((d) => (
          <div key={d.id} data-testid="pro-domain" data-domain={d.id} className="border-t py-3 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="t-base font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{domainName(d.id as DomainId, t)}</span>
              <span className="t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{shelvesOfDomain(d.id).map((s) => shelfLabel(s, t)).join(" · ")}</span>
            </p>
            <p data-testid="pro-domain-professions" className="mt-0.5 t-sm" style={{ color: "var(--arbor-muted)" }}>
              {d.professions.map((p) => t(professionLabelKey(p))).join(" · ")}
            </p>
            <p data-testid="pro-domain-counts" className="mt-1 t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{proCountsLine(counts.get(d.id), t)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
