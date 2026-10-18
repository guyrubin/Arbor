import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { BrandChip } from "../ui/BrandChip";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { fmtDay } from "../../lib/formatDate";
import { liveGrantRows, type GrantRow } from "../../lib/shareGrants";
import { coParentCopy } from "../../lib/i18nElevation/coParent";
import { CONSULT_EXPORTS_EVENT, listExports } from "../../consult/exportHistory";
import { normalizeExportAudience, type ExportAudience } from "../../consult/packet";
import type { ShareGrant } from "../../types";

/* v4 (Care, together is one screen, no tabs) — what the family has opened to
   others, as two cards side by side, then the trust line:
   (a) Who sees what: the LIVE share grants only (lib/shareGrants isLiveGrant,
       the roster's own rule) as people — an initial, the address and role,
       what they see, and until when (or no end date) — up to three, then
       "Add someone" into the roster (#/sharing). A revoked or expired grant
       never appears, and an unreadable roster says so instead of claiming no
       one has access.
   (b) Past exports: this device's export history (consult/exportHistory —
       metadata only: who it was for and when). The documents themselves are
       never stored, so a row never pretends to re-open one: a professional's
       row prepares an update for the same audience in the builder above, the
       weekly record's row opens the full record (#/reports), and the card
       always ends with that door.
   Replaces the v3 doors (School brief · Appointments · Care summary): School
   brief is the builder's Teacher brief template, Appointments lives under the
   visit head, and the builder IS the care summary. Never a directory. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const SHOWN_GRANTS = 3;
const SHOWN_EXPORTS = 4;
/** The device-history slot Reports' "Save this week's record" writes. */
const WEEKLY_SLOT = "reports-weekly";
/** Avatar fills, by row: ink tokens on white initials (AA). */
const AVATAR_INKS = ["var(--arbor-clay)", "var(--arbor-pink-ink)", "var(--arbor-green-ink)"] as const;

type Roster = { state: "loading" } | { state: "failed" } | { state: "ready"; grants: ShareGrant[] };

const cardCls = "min-w-0 rounded-[var(--r-lg)] border p-4 sm:p-5 flex flex-col gap-3";
const cardStyle: React.CSSProperties = { borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" };
const rowCls = "flex items-center gap-3 rounded-xl px-3 py-2 min-w-0";
const rowStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" };
const linkCls = "self-start inline-flex items-center gap-1 rounded-full min-h-[44px] t-sm font-bold";

function CardHead({ id, icon, tone, shape, title, sub }: { id: string; icon: string; tone: "sapphire" | "peach"; shape: "leaf" | "arch"; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandChip icon={icon} tone={tone} shape={shape} size={38} />
      <div className="min-w-0 flex-1">
        <h2 id={id} className="t-base font-extrabold leading-snug" style={{ color: INK }}>{title}</h2>
        <p className="t-xs" style={{ color: MUTED }}>{sub}</p>
      </div>
    </div>
  );
}

/** The first letter of an address's name part, for the row's initial. */
export function initialOf(who: string): string {
  const name = who.trim().split("@")[0] ?? "";
  const first = Array.from(name.replace(/^[^\p{L}\p{N}]+/u, ""))[0] ?? "";
  return first ? first.toLocaleUpperCase() : "·";
}

/** The "Who sees what" card: the roster state and the live grants as people.
 *  Exported so its rows render under test without a network read. */
export function WhoSeesWhat({ state, rows }: { state: "loading" | "failed" | "ready"; rows: readonly GrantRow[] }) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const extra = rows.length - SHOWN_GRANTS;
  return (
    <section data-testid="care-aside-sharing" aria-labelledby="care-who-title" aria-busy={state === "loading"} className={cardCls} style={cardStyle}>
      <CardHead id="care-who-title" icon="share" tone="sapphire" shape="leaf" title={t("elev.consult.aside.sharing")} sub={t("elev.consult.who.sub")} />
      {state === "loading" ? (
        <p className="t-sm" style={{ color: MUTED }}>{t("elev.consult.sharing.loading")}</p>
      ) : state === "failed" ? (
        <p data-testid="care-aside-sharing-unavailable" className="t-sm" style={{ color: INK }}>{t("elev.consult.sharing.unavailable")}</p>
      ) : rows.length === 0 ? (
        <p data-testid="care-aside-sharing-none" className="t-sm" style={{ color: INK }}>{t("elev.consult.sharing.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.slice(0, SHOWN_GRANTS).map((row, index) => (
            <li key={row.id} data-testid="care-aside-grant" className={rowCls} style={rowStyle}>
              <span aria-hidden="true" className="flex-none inline-flex items-center justify-center w-8 h-8 rounded-full t-xs font-bold" style={{ background: AVATAR_INKS[index % AVATAR_INKS.length], color: "var(--arbor-on-accent)" }}>
                {initialOf(row.who)}
              </span>
              <span className="min-w-0 flex-1 flex flex-col">
                <span className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 t-sm" style={{ color: INK }}>
                  <bdi dir="ltr" className="min-w-0 font-bold break-all">{row.who}</bdi>
                  <span style={{ color: MUTED }}>· {t(row.roleKey)}</span>
                </span>
                <span className="t-xs" style={{ color: MUTED }}>{row.what.length ? row.what.join(", ") : t("sec.sharing.noScopes")}</span>
              </span>
              <span data-testid="care-grant-until" className="flex-none rounded-full px-2.5 py-0.5 t-xs font-bold whitespace-nowrap" style={{ background: "var(--arbor-paper-elevated)", color: row.expiresAt ? "var(--arbor-peach-ink)" : "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}>
                {row.expiresAt ? t("elev.consult.who.until", { date: fmtDay(row.expiresAt, uiLang) }) : t("elev.consult.who.noEnd")}
              </span>
            </li>
          ))}
          {extra > 0 && <li className="t-xs" style={{ color: MUTED }}>{t("elev.consult.sharing.more", { n: extra })}</li>}
        </ul>
      )}
      <button type="button" data-testid="care-aside-manage" onClick={() => setActiveTab("sharing")} className={linkCls} style={{ color: "var(--arbor-clay)" }}>
        {t(state === "ready" && rows.length > 0 ? "elev.consult.aside.manage" : "elev.consult.who.add")}
        <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
      </button>
    </section>
  );
}

export type PastExportRow =
  | { kind: "audience"; audience: ExportAudience; at: string }
  | { kind: "record"; at: string };

/** This device's export history as rows, newest first: a known audience or
 *  the weekly record; any other slot is left out. */
export function pastExportRows(history: readonly { audience: string; at: string }[]): PastExportRow[] {
  return history.flatMap((entry): PastExportRow[] => {
    if (entry.audience === WEEKLY_SLOT) return [{ kind: "record", at: entry.at }];
    const audience = normalizeExportAudience(entry.audience);
    return audience ? [{ kind: "audience", audience, at: entry.at }] : [];
  });
}

/** The "Past exports" card. Exported so its rows render under test. */
export function PastExports({ rows, onPrepareAgain }: { rows: readonly PastExportRow[]; onPrepareAgain?: (audience: ExportAudience) => void }) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const title = (row: PastExportRow) => row.kind === "record"
    ? t("elev.reports.weekly.title")
    : row.audience === "self"
      ? t("elev.carehonesty.consult.audience.self")
      : t("elev.consult.past.audience", { audience: t(`elev.carehonesty.consult.audience.${row.audience}`) });
  return (
    <section data-testid="care-past-exports" aria-labelledby="care-past-title" className={cardCls} style={cardStyle}>
      <CardHead id="care-past-title" icon="history" tone="peach" shape="arch" title={t("elev.consult.past.title")} sub={t("elev.consult.past.sub")} />
      {rows.length === 0 ? (
        <p data-testid="care-past-none" className="t-sm" style={{ color: INK }}>{t("elev.consult.past.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.slice(0, SHOWN_EXPORTS).map((row) => (
            <li key={`${row.kind}:${row.kind === "audience" ? row.audience : "weekly"}`} className="min-w-0">
              <button
                type="button"
                data-testid="care-past-row"
                data-export={row.kind === "audience" ? row.audience : "record"}
                onClick={() => (row.kind === "record" ? setActiveTab("reports") : onPrepareAgain?.(row.audience))}
                className={`${rowCls} w-full min-h-[44px] text-start transition hover:brightness-[0.98]`}
                style={{ ...rowStyle, color: INK }}
              >
                <Icon name={row.kind === "record" ? "bar_chart" : row.audience === "teacher" ? "backpack" : "description"} size={18} className="flex-none" style={{ color: MUTED }} />
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className="t-sm font-bold">{title(row)}</span>
                  <span className="t-xs" style={{ color: MUTED }}>
                    {fmtDay(row.at, uiLang)} · {t(row.kind === "record" ? "elev.consult.past.record" : "elev.consult.past.again")}
                  </span>
                </span>
                <Icon name="arrow_forward" size={16} className="flex-none rtl:-scale-x-100" style={{ color: MUTED }} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" data-testid="care-past-record" onClick={() => setActiveTab("reports")} className={linkCls} style={{ color: "var(--arbor-clay)" }}>
        {t("nav.tab.reports")}
        <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
      </button>
    </section>
  );
}

export default function CareShared({ onPrepareAgain }: { onPrepareAgain?: (audience: ExportAudience) => void }) {
  const { childProfile } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();

  const signedIn = !!user;
  const [roster, setRoster] = useState<Roster>({ state: "loading" });
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    setRoster({ state: "loading" });
    api.listShares(childProfile.id)
      .then((r) => { if (live) setRoster({ state: "ready", grants: r.shares || [] }); })
      .catch(() => { if (live) setRoster({ state: "failed" }); });
    return () => { live = false; };
  }, [childProfile.id, signedIn]);
  // Grants live on the server and need an account: signed out, no one can
  // hold one, so "No one yet" is true without asking.
  const rows: GrantRow[] = !signedIn
    ? []
    : roster.state === "ready" ? liveGrantRows(roster.grants, t, coParentCopy[uiLang === "he" ? "he" : "en"].workspaceLabel) : [];
  const sharingState = !signedIn ? "ready" : roster.state;
  // Re-read this device's history when the builder above records an export.
  const [exportsSeen, setExportsSeen] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRecorded = () => setExportsSeen((n) => n + 1);
    window.addEventListener(CONSULT_EXPORTS_EVENT, onRecorded);
    return () => window.removeEventListener(CONSULT_EXPORTS_EVENT, onRecorded);
  }, []);
  const exports = useMemo(() => pastExportRows(listExports(childProfile.id)), [childProfile.id, exportsSeen]);

  return (
    <section data-module="consult-shared" aria-label={t("elev.consult.shared.label")} className="min-w-0 lg:col-span-2 min-[1600px]:col-span-2 flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <WhoSeesWhat state={sharingState} rows={rows} />
        <PastExports rows={exports} onPrepareAgain={onPrepareAgain} />
      </div>
      <p data-testid="consult-trust-line" className="flex items-start gap-2 t-xs leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
        <Icon name="verified_user" size={16} className="flex-shrink-0 mt-px" />
        <span>{t("elev.consult.trust")}</span>
      </p>
    </section>
  );
}
