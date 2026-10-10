import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Modal } from "../ui/Modal";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { sendTextShare } from "../../lib/share";
import type { LoopArtifact } from "../../lib/loopEvents";

/* ════════════════════════════════════════════════════════════════════════════
   B-SHELL-29 — the ONE send sheet (parent register).

   Child content leaves the parent's phone ONLY as text, to one person the
   parent picks in the OS share sheet: "Send to…" opens this sheet with the
   text prefilled per object (the words, the sentence that worked, the week
   page, a kept quote) and EDITABLE; "Send" hands the text — and nothing else
   — to navigator.share, else copies it (lib/share sendTextShare). One closing
   line, "From Arbor — {parent}'s notes about {name}", no URL, no referral
   code, no image, no branded card (lib/shareCard is the kid register's and
   the invite card's only). The invite link lives on the weekly letter.
   ════════════════════════════════════════════════════════════════════════════ */

/** Pure: the prefilled text — the object's lines, then the closing line. No URL. */
export function sendSheetText(lines: readonly (string | null | undefined)[], closing: string): string {
  return [...lines, closing].map((s) => (s ?? "").trim()).filter(Boolean).join("\n");
}

export function SendSheet({
  open,
  onClose,
  text,
  artifact,
  surface,
  beforeSend,
}: {
  open: boolean;
  onClose: () => void;
  /** The prefilled text (sendSheetText); the parent may edit it before sending. */
  text: string;
  artifact: LoopArtifact;
  surface: string;
  /** Optional source-freshness guard. A changed source closes this review
   * before any text reaches the OS share/copy seam. */
  beforeSend?: () => boolean;
}) {
  const { t } = useLanguage();
  const compact = useCompactSurface();
  const [draft, setDraft] = useState(text);
  const [status, setStatus] = useState<"copied" | "error" | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) {
      setDraft(text);
      setStatus(null);
    }
  }, [open, text]);

  const send = async () => {
    if (beforeSend && !beforeSend()) { onClose(); return; }
    const r = await sendTextShare({ artifact, surface, text: draft });
    if (r === "shared") onClose();
    else if (r === "copied") setStatus("copied");
    else if (r === "error") setStatus("error");
  };

  const body = (
    <div data-testid="send-sheet" className="space-y-3">
      <label htmlFor="send-sheet-text" className="block text-[14px]" style={{ color: "var(--arbor-ink-soft)" }}>
        {t("elev.words.send.edit")}
      </label>
      <textarea
        id="send-sheet-text"
        ref={area}
        dir="auto"
        rows={Math.min(10, Math.max(4, draft.split("\n").length + 1))}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full rounded-xl p-3 text-[15px] leading-relaxed focus:outline-none"
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}
      />
      <p className="text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.send.onlyText")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="send-sheet-send"
          disabled={!draft.trim()}
          onClick={() => void send()}
          className="inline-flex min-h-[44px] items-center rounded-xl px-5 text-[15px] font-semibold disabled:opacity-60"
          style={{ background: "var(--arbor-blue)", color: "var(--arbor-on-accent)" }}
        >
          {t("elev.words.send.send")}
        </button>
        {status && (
          <p role="status" className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>
            {status === "copied" ? t("elev.words.page.copied") : t("elev.words.send.error")}
          </p>
        )}
      </div>
    </div>
  );

  return compact ? (
    <Sheet open={open} onClose={onClose} title={t("elev.words.page.send")}>{body}</Sheet>
  ) : (
    <Modal open={open} onClose={onClose} title={t("elev.words.page.send")}>{body}</Modal>
  );
}

/** "Send to…" — the trigger + its sheet. `getText` runs at tap time. */
export function SendButton({
  getText,
  artifact,
  surface,
  label,
  testId = "send-to",
  disabled,
  variant = "outline",
}: {
  getText: () => string;
  artifact: LoopArtifact;
  surface: string;
  label?: string;
  testId?: string;
  disabled?: boolean;
  variant?: "solid" | "outline";
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => {
          setText(getText());
          setOpen(true);
        }}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-[15px] font-semibold disabled:opacity-60"
        style={variant === "solid"
          ? { background: "var(--arbor-blue)", color: "var(--arbor-on-accent)" }
          : { color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)" }}
      >
        {label ?? t("elev.words.page.send")}
      </button>
      {open && <SendSheet open={open} onClose={() => setOpen(false)} text={text} artifact={artifact} surface={surface} />}
    </>
  );
}
