import React from "react";
import { ShieldCheck, Lock, Check } from "lucide-react";
import { Modal } from "./Modal";
import { useLanguage } from "../../context/LanguageContext";

/**
 * P0.5 — the one reusable trust/consent pattern (Hermes brand backlog).
 *
 * Arbor's trust copy was fragmented across AI Rail, the avatar creator, Consult,
 * School Brief and sharing — and some of it (e.g. "never stored") was English-only,
 * so a Hebrew parent could not read the privacy promise about their child's photo.
 *
 * `TrustPanel` renders the three questions every sensitive action should answer —
 * **What Arbor uses / What Arbor stores / What you control** — from caller-supplied,
 * already-translated bullet strings. Presentational only: no network, no state, no
 * gate. Token-only styling (no raw hex, to hold the check:floors hex floor) and
 * `dir="auto"` so it mirrors correctly in Hebrew.
 */
export function TrustPanel({
  uses,
  stores,
  controls,
  tone = "panel",
}: {
  /** Already-translated bullet strings — "what Arbor uses". */
  uses: string[];
  /** Already-translated bullet strings — "what Arbor stores". */
  stores: string[];
  /** Already-translated bullet strings — "what you control". */
  controls: string[];
  tone?: "inline" | "panel";
}) {
  const { t } = useLanguage();
  const groups = [
    { key: "trust.uses.title", Icon: ShieldCheck, items: uses },
    { key: "trust.stores.title", Icon: Lock, items: stores },
    { key: "trust.controls.title", Icon: Check, items: controls },
  ] as const;

  return (
    <div
      dir="auto"
      className={tone === "panel" ? "rounded-2xl p-3 space-y-2.5" : "space-y-2.5"}
      style={tone === "panel" ? { background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" } : undefined}
    >
      {groups.map(({ key, Icon, items }) =>
        items.length > 0 ? (
          <div key={key} className="space-y-1">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {t(key)}
            </p>
            <ul className="space-y-0.5 ps-5">
              {items.map((item, i) => (
                <li key={i} className="text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

/**
 * Explicit review-before-send wrapper for any external share/export. Presentation
 * only — the approval STATE MACHINE stays with each surface (e.g. schoolBrief.ts);
 * this just guarantees the parent sees what leaves Arbor and must click Approve.
 * `onApprove` only ever fires from the explicit Approve button.
 */
export function ReviewBeforeShare({
  open,
  onClose,
  onApprove,
  title,
  body,
  approveLabel,
  cancelLabel,
  eraseReachNoticeKey,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  title: string;
  body?: string;
  approveLabel: string;
  cancelLabel: string;
  /** i18n key for the "once shared, outside Arbor's erase reach" notice. */
  eraseReachNoticeKey?: string;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div dir="auto" className="space-y-3 text-sm">
        {body ? <p style={{ color: "var(--arbor-muted)" }}>{body}</p> : null}
        {children}
        {eraseReachNoticeKey ? (
          <p className="text-[11px] rounded-xl p-2.5" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
            {t(eraseReachNoticeKey)}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs font-bold rounded-xl px-3 py-2"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onApprove}
            className="text-xs font-bold rounded-xl px-3 py-2"
            style={{ background: "var(--arbor-primary)", color: "var(--arbor-on-accent)" }}
          >
            {approveLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
