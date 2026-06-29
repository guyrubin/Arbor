import React, { useEffect, useRef, useState } from "react";
import { Copy, Share2, Check } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api, type ReferralCodeInfo } from "../../lib/api";
import { trackInviteSent } from "../../lib/loopEvents";
import { T } from "../../lib/tokens";

type State =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "error" }
  | { kind: "ready"; info: ReferralCodeInfo };

/**
 * mk-p0-2 referral loop — the in-app invite surface (Settings → Plan block).
 * Shows the parent's stable referral link with Copy + Share (Web Share API when
 * available, clipboard fallback otherwise), wires `trackInviteSent`, and honestly
 * surfaces the earned-months counter / cap. Loading, anon, and error states are
 * all reachable. The link field stays LTR even in Hebrew; copy follows the doc dir.
 */
export default function InviteCard() {
  const { t, uiLang } = useLanguage();
  const { user, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);
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

  const flashCopied = () => {
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    // Respect reduced-motion: still flip the label, just no timed swap-back delay change.
    copyTimer.current = setTimeout(() => setCopied(false), reduce ? 1600 : 1200);
  };

  const doCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      flashCopied();
      trackInviteSent("copy");
    } catch {
      toast(t("set.referral.error"), "error");
    }
  };

  const doShare = async (link: string) => {
    const shareData = { title: "Arbor", text: t("set.referral.shareText"), url: link };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        trackInviteSent("web_share");
      } catch {
        /* user dismissed the share sheet — no error, no event */
      }
    } else {
      await doCopy(link); // fallback already emits trackInviteSent("copy")
    }
  };

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
      <div className="flex flex-wrap gap-2 mt-2" style={{ flexDirection: uiLang === "he" ? "row-reverse" : "row" }}>
        <button
          onClick={() => void doCopy(link)}
          aria-label={t("set.referral.copy")}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] transition"
          style={{ background: "var(--arbor-clay)", color: T.onAccent }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t("set.referral.copied") : t("set.referral.copy")}
        </button>
        <button
          onClick={() => void doShare(link)}
          aria-label={t("set.referral.share")}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] transition"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <Share2 className="w-3.5 h-3.5" /> {t("set.referral.share")}
        </button>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }} aria-live="polite">
        {info.maxed ? t("set.referral.maxed") : t("set.referral.earned", { count: info.earnedMonths })}
      </p>
    </div>
  );
}
