import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useReducedMotion } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api, type ReferralCodeInfo } from "../../lib/api";
import { shareInviteLink } from "../../lib/share";
import { T } from "../../lib/tokens";

type State =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "error" }
  | { kind: "ready"; info: ReferralCodeInfo };

/**
 * B-SHELL-43 — the earned-months line, 0/1/n. It printed "You've earned 0
 * free month(s)" on Weekly. Zero says nothing (the sub line above already
 * says how a month is earned); one has its own sentence in both languages;
 * many carries `{n}` and English's `{plural}` suffix, which the `t` every
 * component holds resolves (LanguageContext resolvePlural — Hebrew takes the
 * explicit one/many key pair instead of a suffix).
 */
export function referralEarnedCopy(earnedMonths: number): { key: string; vars: Record<string, number> } | null {
  const n = Number.isFinite(earnedMonths) ? Math.max(0, Math.floor(earnedMonths)) : 0;
  if (n === 0) return null;
  if (n === 1) return { key: "set.referral.earned.one", vars: {} };
  return { key: "set.referral.earned", vars: { n } };
}

/**
 * mk-p0-2 referral loop — the in-app invite surface. B-SHELL-29: it closes
 * the weekly letter (components/tabs/WeeklyTab.tsx), the ONE place a link
 * leaves the app; it carries no child content.
 * Shows the parent's stable referral link with Copy + Share (Web Share API when
 * available; without it the caption and the link are copied together), sends
 * through lib/share `shareInviteLink` (B-RESID-05: share attribution on the
 * link, share_completed + invite_sent on every completed send), and honestly
 * surfaces the earned-months counter / cap. Loading, anon, and error states are
 * all reachable. The link field stays LTR even in Hebrew; copy follows the doc dir.
 */
export default function InviteCard() {
  const { t } = useLanguage();
  const { user, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [state, setState] = useState<State>({ kind: "loading" });
  // What the last send copied: the link alone (Copy), or the message and the
  // link together (Share with no share sheet), so the button says which.
  const [copied, setCopied] = useState<null | "link" | "invite">(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signedIn = firebaseEnabled ? Boolean(user) : true;

  const load = React.useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const info = await api.referralCode();
      setState(info.code ? { kind: "ready", info } : { kind: "anon" });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (!signedIn) { setState({ kind: "anon" }); return; }
    void load();
  }, [signedIn, load]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const flashCopied = (what: "link" | "invite") => {
    setCopied(what);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    // Respect reduced-motion: still flip the label, just no timed swap-back delay change.
    copyTimer.current = setTimeout(() => setCopied(null), reduce ? 1600 : 1200);
  };

  // One path for both buttons (lib/share): a dismissed sheet says nothing.
  const send = async (link: string, mode: "share" | "copy") => {
    const result = await shareInviteLink({ link, caption: t("set.referral.shareText"), surface: "weekly_invite", mode });
    if (result === "copied") flashCopied(mode === "share" ? "invite" : "link");
    else if (result === "error") toast(t("set.referral.error"), "error");
  };
  const doCopy = (link: string) => send(link, "copy");
  const doShare = (link: string) => send(link, "share");

  if (state.kind === "loading") {
    return (
      <div className="mt-3" aria-busy="true">
        <div className="h-9 rounded-xl animate-pulse" style={{ background: "var(--arbor-paper-deep)" }} />
        <div className="flex gap-2 mt-2">
          <div className="h-9 w-24 rounded-xl animate-pulse" style={{ background: "var(--arbor-paper-deep)" }} />
          <div className="h-9 w-20 rounded-xl animate-pulse" style={{ background: "var(--arbor-paper-deep)" }} />
        </div>
      </div>
    );
  }

  if (state.kind === "anon") {
    return (
      <p className="text-xs mt-3" style={{ color: "var(--arbor-muted)" }}>
        {t("set.referral.signin")}
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mt-3">
        <p className="text-xs" style={{ color: "var(--arbor-pink-ink)" }} aria-live="polite">
          {t("set.referral.error")}
        </p>
        <button
          onClick={() => void load()}
          className="mt-2 inline-flex items-center justify-center text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          {t("set.referral.retry")}
        </button>
      </div>
    );
  }

  const { info } = state;
  const link = info.link ?? "";
  const earned = referralEarnedCopy(info.earnedMonths);

  return (
    <div className="mt-3">
      <label htmlFor="arbor-referral-link" className="sr-only">{t("set.referral.title")}</label>
      <input
        id="arbor-referral-link"
        type="text"
        readOnly
        dir="ltr"
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full text-xs rounded-xl px-3 py-2.5 min-h-[44px]"
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
      />
      {/* B-SHELL-29: the row follows the document direction (it was
          row-reverse in Hebrew, which put Copy last in RTL). */}
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => void doCopy(link)}
          aria-label={t("set.referral.copy")}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] transition"
          style={{ background: "var(--arbor-blue)", color: T.onAccent }}
        >
          {copied === "link" ? <Icon name="check" size={14} /> : <Icon name="content_copy" size={14} />}
          {copied === "link" ? t("set.referral.copied") : t("set.referral.copy")}
        </button>
        <button
          onClick={() => void doShare(link)}
          aria-label={t("set.referral.share")}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] transition"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          {copied === "invite" ? <><Icon name="check" size={14} /> {t("elev.words.invite.copied")}</> : <><Icon name="share" size={14} /> {t("set.referral.share")}</>}
        </button>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }} aria-live="polite">
        {info.maxed ? t("set.referral.maxed") : earned && t(earned.key, earned.vars)}
      </p>
    </div>
  );
}
