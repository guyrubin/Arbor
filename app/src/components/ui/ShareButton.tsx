/**
 * ShareButton (mk-p0-3 → B-SHELL-29) — the parent-register "Send to…" for
 * every loop artifact. Since B-SHELL-29 it opens the ONE send sheet
 * (components/share/SendSheet) with the object's words as editable plain
 * text and one closing line — child content leaves the parent's phone ONLY
 * as text, to one person: no rendered PNG, no referral code, no link. The
 * call-site contract is unchanged (artifact · surface · getCardOpts ·
 * captionKey · label), so every mount converted at once; `getCardOpts`
 * supplies the words at tap time. lib/shareCard stays for the kid register
 * and the invite card only (share.noChildImages.test pins it).
 *
 * a11y: real <button>, descriptive aria-label, 44 px, focus-visible ring.
 */
import React, { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { resolveCaptionKey } from "../../lib/shareCaption";
import { textFromCardOpts } from "../../lib/share";
import type { LoopArtifact } from "../../lib/loopEvents";
import type { ShareCardOpts } from "../../lib/shareCard";
import { SendSheet, sendSheetText } from "../share/SendSheet";

/** Pure: the text a ShareButton prefills — the card's words (else its caption,
 *  link-free), then the closing line. */
export function shareButtonText(
  opts: ShareCardOpts,
  args: { caption: string; parent: string; childName?: string; t: (k: string, v?: Record<string, string | number>) => string },
): string {
  const name = (opts.name || args.childName || "").split(" ")[0];
  const words = textFromCardOpts(opts);
  const lines = words.length
    ? words
    : [args.t(args.caption, { name, url: "" }).replace(/https?:\/\/\S+/g, "").replace(/\s+([.,!?])/g, "$1").trim()];
  const closing = name
    ? args.t("elev.words.page.closing", { parent: args.parent, name })
    : args.t("elev.words.send.closingNoName", { parent: args.parent });
  return sendSheetText(lines, closing);
}

export function ShareButton({
  artifact,
  surface,
  getCardOpts,
  captionKey,
  label,
  variant = "ghost",
  childName,
  beforeShare,
  disabled = false,
}: {
  artifact: LoopArtifact;
  surface: string;
  /** Lazily supplies the object's words at tap time. */
  getCardOpts: () => ShareCardOpts;
  /** i18n caption key; the fallback line when the object has no words of its own. */
  captionKey?: string;
  label?: string;
  variant?: "solid" | "ghost";
  /** Child name for the aria-label and the closing line. */
  childName?: string;
  /** Optional source guard for record-backed callers, checked again on Send. */
  beforeShare?: () => boolean;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const defaultLabel = label ?? t("elev.words.page.send");
  const caption = resolveCaptionKey({ artifact, surface, captionKey });
  const parent = (user?.displayName || t("nav.parent")).split(" ")[0];

  const onShare = () => {
    if (disabled || (beforeShare && !beforeShare())) return;
    setText(shareButtonText(getCardOpts(), { caption, parent, childName, t }));
    setOpen(true);
  };

  const solid = variant === "solid";
  const aria = childName ? `${defaultLabel} — ${childName}` : defaultLabel;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onShare}
        disabled={disabled}
        aria-label={aria}
        className="inline-flex items-center justify-center gap-1.5 font-semibold text-[13px] rounded-full px-4 min-h-[44px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arbor-clay)] focus-visible:ring-offset-1"
        style={
          solid
            ? { background: "var(--arbor-blue)", color: "var(--arbor-on-accent)" }
            : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }
        }
      >
        <Icon name="share" size={16} />
        {defaultLabel}
      </button>
      {open && !disabled && <SendSheet open={open} onClose={() => setOpen(false)} text={text} artifact={artifact} surface={surface} beforeSend={beforeShare} />}
    </div>
  );
}

export default ShareButton;
