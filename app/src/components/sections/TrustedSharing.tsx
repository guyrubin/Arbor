import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { requestOpenSettings } from "../layout/settingsBus";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError, PaywallError, SEAT_IN_USE } from "../../lib/api";
import type { ShareGrant, ShareRole, SharedPacketView } from "../../types";
import Modal from "../ui/Modal";
import { PageHeader, SectionCard, cardCls, Chip, PASTEL, PastelKey, InitialsTile } from "../ui/kit";
import { ErrorState } from "../ui/ErrorState";
import { REPORTS } from "./Reports";
import { isProfessionalReportType } from "../../lib/reportExport";
import { REPORT_SCOPE_BY_TYPE, WEEK_SHARE_SCOPES, WEEK_SHARE_DURATION, type ShareScopeId, scopeDisplayLabels, shareScopeLabelKey } from "../../lib/shareScopes";
import { fmtDay } from "../../lib/formatDate";
// LC-17: the review step shows the RECIPIENT'S ACTUAL VIEW, built by the same
// function the server uses for them — not a list of scope labels.
import { buildPacketInput, buildSharedScopePacket, itemText, sectionTitle, sectionNote } from "../../consult/packet";
import { ClinicalLanguageError } from "../../lib/clinicalScan";

// IA W4.5 + CARE-3: the professional share scopes mirror the W4.1 preset
// audiences one-to-one — derived from the single REPORTS definition
// (Reports.tsx) via stable scope IDs (lib/shareScopes.ts). Grants store the
// IDs; localized labels resolve at render and can never leak into enforcement.
const PRESET_SCOPE_IDS = REPORTS.flatMap((r) => (isProfessionalReportType(r.type) ? [REPORT_SCOPE_BY_TYPE[r.type]] : []));
const SCOPE_OPTIONS: ShareScopeId[] = ["story_timeline", "weekly_insight", "behavior_patterns", "milestones", ...PRESET_SCOPE_IDS];
// Stable duration IDs sent to the server (expiryFromDuration reads "30"/"60"/
// "term"/"revok" out of them); localized labels via share.duration.* keys.
const DURATIONS = ["30d", "60d", "term", "until_revoked"] as const;
const ROLES: ShareRole[] = ["co_parent", "viewer", "professional"];
const ROLE_TONE: Record<ShareRole, PastelKey> = { co_parent: "mint", professional: "sky", viewer: "lav" };

/** Care Network › Trusted Sharing — the ONE roster surface (W4.4 merged the
 *  former My Care Team here): the people coordinating around the child, derived
 *  from real, server-enforced share grants — scoped, time-boxed, revocable
 *  (incl. co-parents) — plus what's shared with you. */
/** W2-CAREPRO r2 — what ONE tap on the week card's stamped button does: a
 *  valid email grants (the preview is already on screen); anything else
 *  focuses the field with the inline hint. There is no preview-only tap. */
export function weekPrimaryAction(email: string): "grant" | "hint" {
  return /^\S+@\S+\.\S+$/.test(email.trim()) ? "grant" : "hint";
}

export default function TrustedSharing() {
  const { childProfile, openPaywall, setActiveTab, activeTab, behaviorLogs, milestones, actionPlans, approvedMemoryItems } = useArbor();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // CARE-3: display resolvers — stable IDs → localized labels, at render only.
  const roleLabel = (r: ShareRole) => t(`share.role.${ROLES.includes(r) ? r : "viewer"}`);
  const scopesLabel = (scopes: string[]) => scopeDisplayLabels(scopes, t).join(", ");
  const expiryLabel = (g: ShareGrant) =>
    g.expiresAt ? t("sec.sharing.expires", { date: fmtDay(g.expiresAt, uiLang) }) : t("share.duration.until_revoked");

  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [inbound, setInbound] = useState<ShareGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // OBJ-LEARN-02: the wizard opened inline with focus still on the button that
  // opened it, so a keyboard or screen-reader user had to hunt for the form
  // they had just asked for. Focus moves to its first control instead.
  const recipientRef = React.useRef<HTMLInputElement | null>(null);
  const [reviewing, setReviewing] = useState(false);
  // B-CAREPRO-10(c): the wizard opens on `viewer` until G1 decides whether a
  // co-parent invite is free. `viewer` grants the identical read-only view on
  // every plan; defaulting to co_parent sent every Free/Plus first share to
  // the Family paywall.
  const DEFAULT_ROLE: ShareRole = "viewer";
  const [draft, setDraft] = useState({ recipientEmail: "", role: DEFAULT_ROLE as ShareRole, scopes: [] as ShareScopeId[], duration: DURATIONS[0] as string });
  // B-CAREPRO-10(a): the seat-in-use 409 → a hint naming the live co-parent.
  const [seatInUse, setSeatInUse] = useState<{ email: string | null; grantId: string | null } | null>(null);
  // LC-17: after a grant is created there is no server email — the recipient
  // learns nothing unless they already use Arbor and happen to open #/sharing.
  // The parent gets a prefilled invite to send themselves, and the copy says
  // plainly that Arbor does not email them.
  const [invite, setInvite] = useState<{ email: string } | null>(null);

  /* LC-17 — "Choose exactly who sees what" was only half true: the review step
     listed scope CHIPS ("Weekly insight", "Milestones"), never the content.
     This builds the recipient's actual read-only packet with
     buildSharedScopePacket — the SAME function server/sharedPacket.ts calls for
     them, with the same fail-closed guards — so the parent consents to what is
     really shared. A blocked build shows the reason and no text (fail closed).
     CLINICAL FIREWALL: the packet is counts + parent observations; the guards
     run here exactly as they do at the server egress. */
  const previewPacket = React.useMemo(() => {
    if (draft.scopes.length === 0) return { sections: null as null | { id: string; title: string; items: { id: string; text: string }[] }[], blocked: false };
    try {
      // LC-17b: the input is assembled by the SHARED assembler the server's
      // recipient path calls (consult/packet.buildPacketInput) — not by a
      // hand-rolled object here. A hand-rolled one is exactly how this preview
      // came to drop every log `trigger` (so the parent approved a preview with
      // no triggers section while the recipient read their own trigger words)
      // and to derive an age the server did not.
      const packet = buildSharedScopePacket(
        draft.scopes,
        draft.role === "professional",
        buildPacketInput(
          { profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: approvedMemoryItems },
          Date.now()
        )
      );
      return { sections: packet.sections, blocked: false };
    } catch (err) {
      return { sections: null, blocked: err instanceof ClinicalLanguageError };
    }
  }, [draft.scopes, draft.role, childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems]);

  /* B-CAREPRO-26 — "Share {name}'s week" is the FIRST card: email → "See what
     they will see" (tap 1, the recipient's own packet, same builder + same
     assembler as the server) → "Share {name}'s week" (tap 2, a live grant).
     Role = DEFAULT_ROLE until G1 decides whether the co-parent seat is free
     (`viewer` gives the identical read-only view on every plan). */
  const WEEK_ROLE: ShareRole = DEFAULT_ROLE;
  const [weekEmail, setWeekEmail] = useState("");
  const weekEmailValid = weekPrimaryAction(weekEmail) === "grant";
  // W2-CAREPRO r2: ONE tap shares. The recipient preview renders inline as
  // soon as the email is valid (no tap), so the stamped button grants on its
  // first tap — a parent can no longer leave after a preview-only tap that
  // used the same "Share {name}'s week" label and granted nothing.
  const weekPreviewing = weekEmailValid;
  // W2-CAREPRO r1: ONE stamped button carries the card at rest and in preview.
  // At rest it opens the recipient preview (an empty/invalid email focuses the
  // field with an inline hint — never an opacity-disabled primary); in preview
  // the same button confirms the grant.
  const weekEmailRef = useRef<HTMLInputElement>(null);
  const [weekHint, setWeekHint] = useState(false);
  const weekPreview = React.useMemo(() => {
    if (!weekPreviewing) return { sections: null as null | { id: string; title: string; items: { id: string; text: string }[] }[], blocked: false };
    try {
      const packet = buildSharedScopePacket(
        [...WEEK_SHARE_SCOPES],
        false, // the week card never grants the professional view
        buildPacketInput(
          { profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: approvedMemoryItems },
          Date.now()
        )
      );
      return { sections: packet.sections, blocked: false };
    } catch (err) {
      return { sections: null, blocked: err instanceof ClinicalLanguageError };
    }
  }, [weekPreviewing, childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems]);

  // W2-CAREPRO c2 r1 (B-CAREPRO-NEW-c2-1j): what the co-parent will read this
  // week, AT REST — the newest of the parent's own moment words the week grant
  // releases (story_timeline → the packet's 7-day moments section, same builder
  // and same scan as the server), with its weekday. Never AI text, no counts.
  const weekAtRest = React.useMemo(() => {
    try {
      const packet = buildSharedScopePacket(
        [...WEEK_SHARE_SCOPES],
        false,
        buildPacketInput(
          { profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: approvedMemoryItems },
          Date.now()
        )
      );
      const first = packet.sections.find((s) => s.id === "moments")?.items.find((it) => it.id.startsWith("moment-"));
      const quote = first && typeof first.vars?.quote === "string" ? first.vars.quote : null;
      const day = first?.vars?.date;
      const iso = day && typeof day === "object" && "dayOf" in day ? day.dayOf : null;
      return quote ? { quote, iso } : null;
    } catch {
      return null;
    }
  }, [childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems]);
  const weekday = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(Date.parse(`${iso}T12:00:00Z`)) : "";

  /** LC-17: a prefilled invite the PARENT sends. Arbor sends no email. */
  const inviteHref = (email: string): string => {
    const link = `${typeof window === "undefined" ? "" : window.location.origin}/#/sharing`;
    const subject = t("elev.learnCare.share.invite.subject", { child: childProfile.name });
    const body = t("elev.learnCare.share.invite.body", { child: childProfile.name, link });
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    // Track each call independently: a partial failure still renders what loaded,
    // but a total failure surfaces a real error/retry instead of a false "empty" roster.
    let aFailed = false;
    let bFailed = false;
    try {
      const [mine, toMe] = await Promise.all([
        // CARE-6: one owner fetch returns the FULL grant record set (history=1);
        // live grants form the roster, ended ones the sharing history below.
        api.listShares(childProfile.id, { history: true }).catch(() => { aFailed = true; return { shares: [] }; }),
        api.sharedWithMe().catch(() => { bFailed = true; return { shares: [] }; }),
      ]);
      setShares(mine.shares || []);
      setInbound(toMe.shares || []);
      if (aFailed && bFailed) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [childProfile.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (adding) recipientRef.current?.focus(); }, [adding]);

  // CARE-6 + CARE-8: the roster shows only live grants; revoked/expired grants
  // move to the persistent "Sharing history" card — the grant records
  // (createdAt/expiresAt/revokedAt) ARE the audit trail, surviving reloads.
  const isLiveGrant = (g: ShareGrant) => !g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) > Date.now());
  const team = shares.filter(isLiveGrant);
  const history = shares.filter((g) => !isLiveGrant(g));
  // F-09: explicit-month app-locale date, never the browser's numeric default.
  const fmtDate = (iso: string | null) => fmtDay(iso, uiLang);

  const setScope = (f: ShareScopeId) => setDraft((d) => ({ ...d, scopes: d.scopes.includes(f) ? d.scopes.filter((x) => x !== f) : [...d.scopes, f] }));

  /** One grant path for the week card and the custom wizard (same toasts,
   *  same invite hand-off, same seat / paywall handling). */
  const grant = async (g: { email: string; role: ShareRole; scopes: ShareScopeId[]; duration: string }, busyKey: string, onDone: () => void) => {
    setBusy(busyKey);
    try {
      await api.createShare({ childId: childProfile.id, childName: childProfile.name, recipientEmail: g.email, role: g.role, scopes: g.scopes, duration: g.duration });
      toast(t("sec.sharing.audit.shared", { scopes: scopesLabel(g.scopes), email: g.email, role: roleLabel(g.role) }), "success");
      setInvite({ email: g.email });
      setSeatInUse(null);
      onDone();
      await load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409 && e.message === SEAT_IN_USE) {
        // No paywall: the parent already holds the seat. Point at the row.
        const holder = shares.find((g) => g.role === "co_parent" && isLiveGrant(g)) ?? null;
        setSeatInUse({ email: holder?.recipientEmail ?? null, grantId: holder?.id ?? null });
      } else if (e instanceof PaywallError) openPaywall(e.feature, e.plan);
      // B-CAREPRO-15: keyed copy only — the server's English e.message never reaches a Hebrew family.
      else toast(t("sec.sharing.audit.createError"), "error");
    } finally {
      setBusy(null);
    }
  };

  const createShare = async () => {
    const email = draft.recipientEmail.trim();
    if (!email || draft.scopes.length === 0) return;
    await grant({ email, role: draft.role, scopes: draft.scopes, duration: draft.duration }, "create", () => {
      setDraft({ recipientEmail: "", role: DEFAULT_ROLE, scopes: [], duration: DURATIONS[0] });
      setReviewing(false);
      setAdding(false);
    });
  };

  const shareWeek = async () => {
    const email = weekEmail.trim();
    if (!weekEmailValid) return;
    await grant({ email, role: WEEK_ROLE, scopes: [...WEEK_SHARE_SCOPES], duration: WEEK_SHARE_DURATION }, "week", () => {
      setWeekEmail("");
    });
  };

  const onWeekPrimary = () => {
    if (weekPrimaryAction(weekEmail) === "hint") { setWeekHint(true); weekEmailRef.current?.focus(); return; }
    setWeekHint(false);
    void shareWeek();
  };

  const revoke = async (g: ShareGrant) => {
    setBusy(g.id);
    try {
      await api.revokeShare(g.id);
      // CARE-6: no ephemeral log needed — the reload moves the revoked grant
      // (with its revocation date) into the persistent Sharing history card.
      toast(t("sec.sharing.audit.revoked", { email: g.recipientEmail }), "success");
      await load();
    } catch (e: any) {
      toast(t("sec.sharing.audit.revokeError"), "error");
    } finally {
      setBusy(null);
    }
  };

  // CARE-2: the recipient shared VIEW — clicking an inbound card opens a
  // read-only viewer of exactly the granted scopes, assembled server-side
  // through the fail-closed consult-packet egress (counts only, no raw
  // documents, no write access). A 403/404 means the share has ended → the
  // card disappears from the inbound roster.
  const [viewing, setViewing] = useState<ShareGrant | null>(null);
  const [view, setView] = useState<SharedPacketView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<"ended" | "blocked" | "generic" | null>(null);

  const openSharedView = async (g: ShareGrant) => {
    setViewing(g);
    setView(null);
    setViewError(null);
    setViewLoading(true);
    try {
      setView(await api.sharedPacket(g.id));
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        // Server says no access NOW (revoked/expired/fail-closed scopes):
        // drop the dead card so the roster reflects reality.
        setViewError("ended");
        setInbound((prev) => prev.filter((x) => x.id !== g.id));
      } else if (e instanceof ApiError && e.status === 422) {
        setViewError("blocked");
      } else {
        setViewError("generic");
      }
    } finally {
      setViewLoading(false);
    }
  };

  const closeSharedView = () => {
    setViewing(null);
    setView(null);
    setViewError(null);
  };

  // B-CAREPRO-35: export and erasure live in ONE home — Settings › Your data
  // (components/layout/YourDataSheet: the complete exportChildData sweep and
  // the typed-name → eraseEverything → DeletionReceipt flow that used to sit
  // here). This page links there.

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[920px] flex flex-col gap-6">
      {/* W2-CAREPRO r2: flush — the column's gap-6 is the only rhythm. */}
      <PageHeader
        flush
        eyebrow={t("nav.care")}
        title={t("sec.sharing.title")}
        subtitle={t("sec.sharing.sub", { name: first })}
      />

      {error && (
        <ErrorState
          surface="care-team"
          headline={t("err.careTeam.title")}
          body={t("err.careTeam.body", { name: first })}
          onRetry={() => void load()}
          retryLabel={t("err.retry")}
          retrying={loading}
        />
      )}

      {/* LC-17 — the recipient is never notified: there is no server email on
          POST /shares and no client invite path existed. The parent gets a
          prefilled message to send themselves, and the copy says so. */}
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      {/* R25: ONE module for the grant flow — the wizard and the invite
          hand-off it produces (LC-17) are two steps of one capability, so
          they carry one stamp between them rather than competing as two. */}
      <div data-module="sharing-grant" style={{ display: "contents" }}>
      {!error && (
        <section data-testid="share-week-card" className="rounded-[22px] p-5 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-x-6 lg:gap-y-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
          {/* W2-CAREPRO r2: at lg the card is two columns — what is shared on
              the start side, the email + the one tap on the end side (the email
              field is capped at that column, not ~880 px). */}
          <div className="flex flex-col gap-3 min-w-0 lg:col-start-1 lg:row-start-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}><Icon name="diversity_3" size={20} /></span>
              <h2 className="t-lg font-extrabold min-w-0" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("elev.learnCare.share.week.title", { name: first })}</h2>
            </div>
            <p className="t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.week.body")}</p>
            {/* W2-CAREPRO c2 r1: "What they'll read this week" — the parent's own
                newest words the grant releases, at rest (the card's one warm
                accent beside the one gradient); an honest line when there are none. */}
            <figure data-testid="share-week-atrest" className="p-3" style={{ background: "var(--arbor-paper-deep)", borderRadius: "var(--r)", borderInlineStart: "2px solid var(--arbor-sky-ink)" }}>
              <figcaption className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.week.atRest")}</figcaption>
              {weekAtRest ? (
                <p className="t-sm mt-0.5 line-clamp-2" style={{ color: "var(--arbor-ink)", fontFamily: uiLang === "he" ? "var(--font-display)" : "var(--font-editorial)" }}>
                  <q dir="auto">{weekAtRest.quote}</q>{weekAtRest.iso ? <> · <bdi>{weekday(weekAtRest.iso)}</bdi></> : null}
                </p>
              ) : (
                <p data-testid="share-week-atrest-empty" className="t-sm mt-0.5" style={{ color: "var(--arbor-ink)" }}>{t("elev.learnCare.share.week.atRestEmpty")}</p>
              )}
            </figure>
            {/* W2-CAREPRO r1: the server-enforcement sentence is the only trust
                line on #/sharing. r2: inside the card, not a caption below it. */}
            <p data-testid="sharing-trust-line" className="t-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.trustNote")}</p>
          </div>
          {/* W2-CAREPRO c2 r1: at lg the email + the one tap are a sticky end
              column spanning both rows, beside the preview it confirms. */}
          <div className="flex flex-col gap-3 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:self-start">
            <div className="space-y-1.5">
              <input
                ref={weekEmailRef}
                value={weekEmail}
                onChange={(e) => { setWeekEmail(e.target.value); setWeekHint(false); }}
                placeholder={t("elev.learnCare.share.week.email")}
                aria-label={t("elev.learnCare.share.week.email")}
                aria-describedby={weekHint ? "share-week-hint" : undefined}
                data-testid="share-week-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="auto"
                className="w-full min-w-0 rounded-xl px-3 min-h-11 text-sm"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
              />
              {weekHint && (
                <p id="share-week-hint" role="alert" data-testid="share-week-hint" className="t-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.learnCare.share.week.needEmail")}</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 sm:items-center lg:items-stretch">
              {/* The route's ONE primary-move stamp: one tap grants (viewer,
                  WEEK_SHARE_SCOPES, until revoked); no email = focus + hint. */}
              <button
                type="button"
                // B-SHELL-20 (a): this leaf serves #/sharing AND #/care-team, so
                // the stamp's VALUE follows the route (ConsultTab pattern).
                data-primary-move={activeTab === "care-team" ? "open-care-roster" : "grant-share"}
                data-testid="share-week-confirm"
                onClick={onWeekPrimary}
                disabled={busy === "week" || (weekPreviewing && weekPreview.blocked)}
                className="touch-target inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl px-5 min-h-11 disabled:cursor-not-allowed"
                style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
              >
                {busy === "week"
                  ? <><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.review.working")}</>
                  : <><Icon name="check" size={16} /> {t("elev.learnCare.share.week.share", { name: first })}</>}
              </button>
              {/* B-CAREPRO-26: the full wizard sits behind "Custom share" — a
                  quiet text door inside the card (W2-CAREPRO r1). */}
              <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} data-testid="sharing-custom-open" className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-bold" style={{ color: "var(--arbor-clay)" }}>
                <Icon name="tune" size={16} /> {t("elev.learnCare.share.week.custom")}
              </button>
            </div>
          </div>
          {weekPreviewing && (
            /* The recipient's actual view — buildSharedScopePacket on the
               shared assembler, the same call server/sharedPacket.ts makes —
               shown with no tap once the email is valid. W2-CAREPRO c2 r1:
               at lg it takes the START column (row 2) at a 60ch measure, not
               the 22rem end column; below lg it follows the email. */
            <div data-testid="share-week-preview" aria-live="polite" className="rounded-xl p-3.5 space-y-2.5 lg:col-start-1 lg:row-start-2 lg:max-w-[60ch]" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <p className="t-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.preview.title")}</p>
              {/* B-DIST-01: what the recipient reads opens with the demo header. */}
              {childProfile.demo === true && (
                <p data-demo-header className="t-xs font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>{t("elev.demo.header")}</p>
              )}
              {weekPreview.blocked ? (
                <p role="alert" className="t-xs font-bold leading-relaxed" style={{ color: "var(--arbor-pink-ink)" }}>{t("elev.learnCare.share.preview.blocked")}</p>
              ) : !weekPreview.sections || weekPreview.sections.length === 0 ? (
                <p className="t-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.preview.empty")}</p>
              ) : (
                weekPreview.sections.map((section) => (
                  <div key={section.id}>
                    <p className="t-sm font-extrabold" dir={uiLang === "he" ? "rtl" : "ltr"} style={{ color: "var(--arbor-ink)" }}>{sectionTitle(section, uiLang)}</p>
                    {/* W2-CAREPRO c2 r1: one direction per list (the UI's);
                        itemText isolates every Latin title/quote and HE dates
                        are Hebrew dates — never a raw ISO day in an RTL line. */}
                    <ul dir={uiLang === "he" ? "rtl" : "ltr"} className="list-disc ps-5 mt-1 space-y-0.5">
                      {section.items.map((it) => (
                        <li key={it.id} className="t-xs leading-relaxed" dir={uiLang === "he" ? "rtl" : "ltr"} style={{ color: "var(--arbor-muted)" }}>{itemText(it, uiLang)}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}
      {invite && (
        <div data-testid="share-invite" className="border-y py-4 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--arbor-rule)" }}>
          <span className="text-sm font-bold break-all" dir="auto" style={{ color: "var(--arbor-ink)" }}>{invite.email}</span>
          <a
            href={inviteHref(invite.email)}
            className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5 min-h-[44px]"
            style={{ background: "var(--arbor-clay)" }}
          >
            <Icon name="mail" size={16} /> {t("elev.learnCare.share.invite.cta")}
          </a>
          <button onClick={() => setInvite(null)} aria-label={t("aria.cancel")} className="touch-target flex-shrink-0">
            <Icon name="close" size={17} style={{ color: "var(--arbor-muted)" }} />
          </button>
          <p className="text-[11.5px] leading-relaxed basis-full" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.invite.hint")}</p>
        </div>
      )}

      {adding && (
        <div className="space-y-4 border-y py-5" style={{ borderColor: "var(--arbor-rule)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("sec.sharing.form.title", { name: first })}</h3>
            <button onClick={() => { setAdding(false); setReviewing(false); }} aria-label={t("aria.cancel")} data-testid="sharing-wizard-close" className="touch-target flex-shrink-0"><Icon name="close" size={17} style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          {!reviewing && <>
          <input ref={recipientRef} value={draft.recipientEmail} onChange={(e) => setDraft({ ...draft, recipientEmail: e.target.value })} placeholder={t("sec.sharing.form.emailPlaceholder")} aria-label={t("sec.sharing.form.emailPlaceholder")} type="email" inputMode="email" autoComplete="email" className="w-full rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.role")}</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button key={r} onClick={() => setDraft({ ...draft, role: r })} aria-pressed={draft.role === r} className="inline-flex items-center rounded-full px-3.5 min-h-11 text-xs font-bold" style={draft.role === r ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{roleLabel(r)}</button>
              ))}
            </div>
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.nothingDefault")}</p>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.what")}</p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPE_OPTIONS.map((f) => {
                const on = draft.scopes.includes(f);
                return <button key={f} onClick={() => setScope(f)} aria-pressed={on} className="inline-flex items-center rounded-full px-3.5 min-h-11 text-xs font-bold" style={on ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{t(shareScopeLabelKey(f))}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.duration")}</p>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button key={d} onClick={() => setDraft({ ...draft, duration: d })} aria-pressed={draft.duration === d} className="inline-flex items-center rounded-full px-3.5 min-h-11 text-xs font-bold" style={draft.duration === d ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{t(`share.duration.${d}`)}</button>
              ))}
            </div>
          </div>
          <button onClick={() => setReviewing(true)} disabled={!/^\S+@\S+\.\S+$/.test(draft.recipientEmail.trim()) || draft.scopes.length === 0} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 min-h-11 disabled:opacity-40" style={{ background: "var(--arbor-clay)" }}>
            {t("sec.sharing.form.review")} <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
          </button>
          </>}
          {reviewing && <div className="space-y-4" aria-live="polite">
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.review.recipient")}</p><p className="text-sm font-extrabold mt-0.5 break-all" dir="auto" style={{ color: "var(--arbor-ink)" }}>{draft.recipientEmail.trim()}</p></div><Chip tone="mint">{roleLabel(draft.role)}</Chip></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.review.canSee")}</p><div className="flex flex-wrap gap-1.5 mt-1.5">{draft.scopes.map((scope) => <Chip key={scope} tone="sky">{t(shareScopeLabelKey(scope))}</Chip>)}</div></div>

              {/* LC-17 — THE ACTUAL PREVIEW. A parent consenting to share their
                  child's data has to see what is being shared, not a label for
                  it. Built with buildSharedScopePacket — the same function the
                  server runs for the recipient, with the same fail-closed
                  guards, so this is the recipient's view and not a mock-up. */}
              <div data-testid="share-scope-preview" className="rounded-xl p-3.5 space-y-2.5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-green-ink)" }}>{t("elev.learnCare.share.preview.title")}</p>
                {/* B-DIST-01: what the recipient reads opens with the demo header. */}
                {childProfile.demo === true && (
                  <p data-demo-header className="t-xs font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>{t("elev.demo.header")}</p>
                )}
                {previewPacket.blocked ? (
                  <p role="alert" className="text-[12px] font-bold leading-relaxed" style={{ color: "var(--arbor-pink-ink)" }}>{t("elev.learnCare.share.preview.blocked")}</p>
                ) : !previewPacket.sections || previewPacket.sections.length === 0 ? (
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.preview.empty")}</p>
                ) : (
                  previewPacket.sections.map((section) => (
                    <div key={section.id}>
                      {/* B-CAREPRO-15: headings in the parent's language (titleKey), never the English fallback. */}
                      <p className="text-[12.5px] font-extrabold" dir="auto" style={{ color: "var(--arbor-ink)" }}>{sectionTitle(section, uiLang)}</p>
                      <ul className="list-disc ps-5 mt-1 space-y-0.5">
                        {section.items.map((it) => (
                          <li key={it.id} className="text-[12px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-muted)" }}>{itemText(it, uiLang)}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-faint)" }}>{t("elev.learnCare.share.preview.hint")}</p>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--arbor-muted)" }}><Icon name="schedule" size={16} /> {t(`share.duration.${draft.duration}`)}</div>
            </div>
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "var(--arbor-yellow-soft)", border: "1px solid var(--arbor-rule)" }}><Icon name="verified_user" size={19} style={{ color: "var(--arbor-yellow-ink)" }} /><p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("sec.sharing.review.note")}</p></div>
            {seatInUse && (
              <div data-testid="share-seat-in-use" role="alert" className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: "var(--arbor-paper-sunk)", border: "1px solid var(--arbor-rule)" }}>
                <Icon name="group" size={19} style={{ color: "var(--arbor-ink)" }} />
                <p className="flex-1 min-w-0 text-xs leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                  {seatInUse.email ? t("elev.learnCare.share.seatInUse", { email: seatInUse.email }) : t("elev.learnCare.share.seatInUse.unnamed")}
                </p>
                {seatInUse.grantId && (
                  <button
                    type="button"
                    onClick={() => {
                      const row = document.getElementById(`share-row-${seatInUse.grantId}`);
                      row?.scrollIntoView({ behavior: "smooth", block: "center" });
                      row?.focus();
                    }}
                    className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-xs font-bold"
                    style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  >
                    {t("elev.learnCare.share.seatInUse.show")}
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end"><button onClick={() => setReviewing(false)} className="inline-flex items-center justify-center rounded-xl px-4 min-h-11 text-sm font-bold" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>{t("sec.sharing.review.back")}</button><button data-testid="sharing-wizard-approve" onClick={createShare} disabled={busy === "create"} className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-xl px-4 min-h-11 disabled:opacity-60" style={{ background: "var(--arbor-clay)" }}>{busy === "create" ? <><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.review.working")}</> : t("sec.sharing.review.approve")}</button></div>
          </div>}
        </div>
      )}

      {/* CARE-8: ONE roster — the people coordinating around the child, exactly
          one card per live grant (the richer InitialsTile visual, W4.4 intent)
          with the revoke action folded in. The former duplicate "Active shares"
          list is gone. */}
      </div>

      {!error && (
        <div data-module="sharing-roster" style={{ display: "contents" }}>
        {/* W2-CAREPRO r2: with nobody on the roster, one muted line — not a
            full card repeating the week card's ask. */}
        {!loading && team.length === 0 ? (
          <p data-testid="sharing-roster-empty" className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.active.empty")}</p>
        ) : (
        <SectionCard title={t("sec.sharing.team.title", { name: first })} icon={<Icon name="diversity_3" size={20} fill={1} />} tone="mint">
          {loading ? (
            <p className="text-sm flex items-center gap-2" style={{ color: "var(--arbor-muted)" }}><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.active.loading")}</p>
          ) : team.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.active.empty")}</p>
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {team.map((g) => {
                const tone = ROLE_TONE[g.role] || ROLE_TONE.viewer;
                return (
                  <div key={g.id} id={`share-row-${g.id}`} tabIndex={-1} className="min-w-0 border-b p-4 last:border-b-0" style={{ borderColor: "var(--arbor-rule)" }}>
                    <div className="flex items-center gap-3">
                      <InitialsTile name={g.recipientEmail} tone={tone} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-extrabold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{g.recipientEmail}</h3>
                        <p className="text-xs" style={{ color: PASTEL[tone].ink }}>{roleLabel(g.role)}</p>
                      </div>
                      <button onClick={() => revoke(g)} disabled={busy === g.id} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold disabled:opacity-50" style={{ color: "var(--arbor-pink-ink)" }}>
                        {busy === g.id ? <Icon name="progress_activity" size={14} className="animate-spin" /> : <Icon name="close" size={15} />} {t("sec.sharing.revoke")}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{scopesLabel(g.scopes) || t("sec.sharing.noScopes")}</Chip>
                      <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(g)}</Chip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        )}
        </div>
      )}

      {/* R25 (item 11) — #/sharing rendered 5 top-level modules against a declared
          moduleBudget of 2. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
      <details data-module-disclosure="sharing-more" className={`${cardCls} p-0 overflow-hidden`}>
        <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Icon name="history" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.learnCare.share.more.title")}</span>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.share.more.sub")}</span>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div className="px-4 pb-4 space-y-4">
        {/* demotionTarget: "consult" — the hub the contract sends these to. */}
        <button onClick={() => setActiveTab("consult")} className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}>
          <span>{t("elev.learnCare.share.more.door")}</span>
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
        </button>
      {!error && inbound.length > 0 && (
        <div data-module="sharing-inbound" data-module-demoted style={{ display: "contents" }}>
        <SectionCard title={t("sec.sharing.inbound.title")} icon={<Icon name="inbox" size={20} />} tone="lav">
          <div className="space-y-3">
            {inbound.map((s) => (
              <div key={s.id} className={`${cardCls} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{s.childName || t("sec.sharing.inbound.aChild")}</h3>
                    <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.inbound.fromRole", { owner: s.ownerEmail || "—", role: roleLabel(s.role) })}</p>
                  </div>
                  <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(s)}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{scopesLabel(s.scopes) || t("sec.sharing.noScopes")}</Chip>
                </div>
                {/* CARE-2: the card is no longer a dead end — open the read-only view. */}
                <button
                  onClick={() => void openSharedView(s)}
                  data-testid={`shared-view-open-${s.id}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  <Icon name="visibility" size={17} /> {t("sec.sharing.viewer.open")}
                  <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
        </div>
      )}

      <div data-module="sharing-data-and-history" data-module-demoted className="grid min-w-0 gap-4 sm:grid-cols-2">
        <SectionCard title={t("sec.sharing.data.title")} icon={<Icon name="download" size={20} />} tone="lav">
          <button
            type="button"
            data-testid="sharing-your-data-link"
            onClick={() => requestOpenSettings({ focus: "data" })}
            className="w-full inline-flex items-center justify-between gap-2 text-sm font-bold rounded-xl px-4 min-h-11"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
          >
            <span className="inline-flex items-center gap-2"><Icon name="verified_user" size={18} /> {t("elev.yourData.link", { name: first })}</span>
            <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
          </button>
        </SectionCard>
        {/* CARE-6: REAL sharing history — rendered from the persistent grant
            records (created/expired/revoked with dates), not a session-ephemeral
            list. Grants ARE the audit record; it survives any reload. */}
        <SectionCard title={t("sec.sharing.history.title")} icon={<Icon name="history" size={20} />} tone="sky">
          {history.length === 0 ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.history.empty")}</p>
          ) : (
            <ul className="space-y-2.5 text-xs max-h-44 overflow-y-auto" data-testid="sharing-history">
              {history.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate" dir="auto" style={{ color: "var(--arbor-ink)" }}>{g.recipientEmail}</p>
                    <p style={{ color: "var(--arbor-muted)" }}>{roleLabel(g.role)} · {t("sec.sharing.history.createdOn", { date: fmtDate(g.createdAt) })}</p>
                  </div>
                  <span className="flex-shrink-0 font-bold" style={{ color: "var(--arbor-pink-ink)" }}>
                    {g.revokedAt
                      ? t("sec.sharing.history.revokedOn", { date: fmtDate(g.revokedAt) })
                      : t("sec.sharing.history.expiredOn", { date: fmtDate(g.expiresAt) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

        </div>
      </details>

      {/* CARE-2: read-only recipient viewer — exactly the granted scopes,
          server-assembled and guard-checked. No capture paths, no writes. */}
      <Modal
        open={viewing !== null}
        onClose={closeSharedView}
        title={t("sec.sharing.viewer.title", { name: viewing?.childName || t("sec.sharing.inbound.aChild") })}
      >
        <div className="space-y-4" data-testid="shared-view" aria-live="polite">
          {viewLoading && (
            <p className="text-sm flex items-center gap-2" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.viewer.loading")}
            </p>
          )}
          {!viewLoading && viewError && (
            <p role="alert" className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {t(`sec.sharing.viewer.${viewError === "ended" ? "ended" : viewError === "blocked" ? "blocked" : "error"}`)}
            </p>
          )}
          {!viewLoading && !viewError && view && (
            <>
              <div className="rounded-2xl p-3 flex items-start gap-2.5" style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" }}>
                <Icon name="verified_user" size={18} style={{ color: "var(--arbor-green-ink)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
                  {t("sec.sharing.viewer.readOnly", { owner: view.ownerEmail || "—" })}
                </p>
              </div>
              {view.demo === true && (
                <p data-demo-header className="text-xs font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>{t("elev.demo.header")}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {view.scopes.map((scope) => <Chip key={scope} tone="sky">{scopeDisplayLabels([scope], t)[0] || scope}</Chip>)}
              </div>
              {view.sections.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.viewer.empty")}</p>
              ) : (
                view.sections.map((section) => (
                  <div key={section.id} className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                    <h3 className="text-sm font-extrabold" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{sectionTitle(section, uiLang)}</h3>
                    {sectionNote(section, uiLang) && <p className="text-[11px]" dir="auto" style={{ color: "var(--arbor-muted)" }}>{sectionNote(section, uiLang)}</p>}
                    <ul className="space-y-1.5">
                      {section.items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2 text-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                          <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full" style={{ background: "var(--arbor-muted)" }} />
                          {itemText(item, uiLang)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </>
          )}
          <div className="flex sm:justify-end">
            <button onClick={closeSharedView} className="w-full sm:w-auto rounded-xl px-4 py-2.5 min-h-11 min-w-11 text-sm font-bold" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>
              {t("sec.sharing.viewer.close")}
            </button>
          </div>
        </div>
      </Modal>

    </motion.div>
  );
}
