import React from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { PASTEL, Chip, domainVisual, type PastelKey } from "../ui/kit";
import type { TimelineSignal, SignalProvenance } from "../../lib/signalTimeline";
import type { DevelopmentalDomainId } from "../../types";

/**
 * TJB-13 — the tapped journal row.
 *
 * Journal rows were inert `<article>`s: a parent could see "Meltdown · 4:12 PM"
 * and had no way to read the rest of what they wrote, let alone fix a typo.
 * The moment they captured was, in practice, write-only. This sheet is the
 * detail view, and for a moment (a behaviorLog the PARENT owns) it hands off
 * to the one existing edit seam — `startEditLog` + the Behaviors capture form
 * — rather than forking a second editor.
 *
 * READ + ROUTE only: no new write path, no second copy of the log form.
 * Rows that Arbor or the child authored are read-only here on purpose; the
 * parent does not get to rewrite the child's practice record from the journal.
 *
 * CLINICAL FIREWALL: the sheet shows the entry's own content plus descriptive
 * labels (domain chip, provenance, time). Nothing derived, nothing scored.
 */
export default function JournalEntrySheet({
  signal,
  domain,
  domainLabel,
  provLabel,
  prov,
  when,
  title,
  detail,
  onClose,
  onEdit,
}: {
  signal: TimelineSignal | null;
  domain: DevelopmentalDomainId | null;
  domainLabel: string;
  provLabel: string;
  prov: SignalProvenance;
  /** Fully-formatted date+time for this entry, or "" for undated rows. */
  when: string;
  title: string;
  detail: string;
  onClose: () => void;
  /** Present only for parent-owned moments — routes into the existing editor. */
  onEdit?: () => void;
}) {
  const { t } = useLanguage();
  const tone: PastelKey = signal
    ? (domain ? domainVisual(domain).tone : (signal.tone as PastelKey))
    : "lav";
  const p = PASTEL[tone];

  return (
    <Modal open={!!signal} onClose={onClose} title={t("elev.closeloop.entry.title")}>
      {signal && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span
              className="inline-flex flex-shrink-0 items-center justify-center rounded-full"
              style={{ width: 44, height: 44, background: p.soft, color: p.ink }}
            >
              <Icon name="description" size={22} fill={1} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                {title}
              </p>
              {detail && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                  {detail}
                </p>
              )}
            </div>
          </div>

          {signal.photo && (
            <img
              src={signal.photo}
              alt=""
              className="w-full rounded-2xl border object-cover"
              style={{ borderColor: "var(--arbor-rule)", maxHeight: 260 }}
            />
          )}

          <dl className="grid grid-cols-2 gap-3 text-[12px]">
            {when && (
              <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-deep)" }}>
                <dt className="font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>
                  {t("elev.closeloop.entry.when")}
                </dt>
                <dd className="mt-1 font-bold" style={{ color: "var(--arbor-ink)" }}>{when}</dd>
              </div>
            )}
            <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-deep)" }}>
              <dt className="font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>
                {t("elev.closeloop.entry.noted")}
              </dt>
              <dd className="mt-1 font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>{provLabel}</dd>
            </div>
          </dl>

          {domain && (
            <Chip tone={tone}>{domainLabel}</Chip>
          )}

          {/* The ONE edit route — the existing Behaviors form. Offered only for
              the parent's own moments; an Arbor- or child-authored row is a
              record, not a draft (prov is read here so that stays explicit). */}
          {onEdit && prov === "manual" && (
            <button
              type="button"
              onClick={onEdit}
              data-testid="journal-entry-edit"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold text-white transition active:scale-[0.98]"
              style={{ background: "var(--arbor-gradient-primary)" }}
            >
              <Icon name="edit_note" size={17} /> {t("elev.closeloop.entry.edit")}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
