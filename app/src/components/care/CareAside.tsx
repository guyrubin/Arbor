import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { CareGlyph } from "./CareVisitHead";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { api } from "../../lib/api";
import { fmtDay } from "../../lib/formatDate";
import { liveGrantRows, type GrantRow } from "../../lib/shareGrants";
import { coParentCopy } from "../../lib/i18nElevation/coParent";
import { careSafetyLines, firstDialableContact, readSafetyReviewed } from "../../safety/safetyLines";
import type { HelplineEntry } from "../../safety/escalation";
import type { ShareGrant } from "../../types";

/* v3 EXTRA-CARE — the Care landing's aside: ONE module, two quiet cards.
   (a) Help and safety: the emergency line and the family's talk line as plain
       tel: links from Safety's own directory and selection, the family's
       first saved contact, and when Safety was last reviewed on this device.
       Safety's one-tap call stays Safety's primary move; nothing here carries
       the route's move, so Care keeps its single build-share-packet act.
   (b) Who sees what: the LIVE share grants only (lib/shareGrants isLiveGrant,
       the roster's own rule), up to three rows, then Manage. A revoked or
       expired grant never appears, and an unreadable roster says so instead
       of claiming no one has access.
   v3 F-CARE-1 (mock :346-353, phone :736-737): the safety card opens on a
   glyph, its title and when it was last reviewed, then the calls, then
   Safety's own crisis words under the accent rule (from sm; Safety holds
   them at every width), then "Open Safety". There is no "Message" action:
   nothing behind it could carry a message, and the saved contact is a call.
   Who sees what puts Manage in its head row and the grants as ruled rows.
   From xl (1280) the aside is the landing's sticky end column. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const SHOWN_GRANTS = 3;

type Contact = { id: string; name: string; phone: string };
type Roster = { state: "loading" } | { state: "failed" } | { state: "ready"; grants: ShareGrant[] };

const cardCls = "min-w-0 rounded-[18px] p-4 sm:p-5 flex flex-col gap-3";
const cardStyle: React.CSSProperties = { background: "var(--arbor-paper-elevated)", boxShadow: "0 0 0 1px var(--arbor-rule), var(--shadow-sm)" };
const secondaryCls = "self-start inline-flex items-center justify-center gap-1.5 rounded-xl px-4 min-h-[44px] t-sm font-bold";
const secondaryStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: INK, border: "1px solid var(--arbor-rule)" };

function CallLine({ entry }: { entry: HelplineEntry }) {
  const { t } = useLanguage();
  return (
    <a
      data-testid="care-aside-call"
      data-line={entry.id}
      href={`tel:${entry.tel}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2 min-h-[44px] text-start"
      style={{ background: "var(--arbor-paper-sunk)", color: INK, border: "1px solid var(--arbor-rule)" }}
    >
      <Icon name="call" size={19} className="flex-shrink-0" style={{ color: "var(--arbor-clay)" }} />
      <span className="min-w-0 flex flex-col">
        <span className="t-sm font-extrabold whitespace-nowrap">{t("elev.carehonesty.safety.callPrimary", { number: entry.number })}</span>
        <span className="t-xs" style={{ color: MUTED }}>{t(`elev.safety.helpline.${entry.id}`)}</span>
      </span>
    </a>
  );
}

/** The "Who sees what" card: the roster state and the live grants as rows.
 *  Exported so its rows render under test without a network read. */
export function WhoSeesWhat({ state, rows }: { state: "loading" | "failed" | "ready"; rows: readonly GrantRow[] }) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const extra = rows.length - SHOWN_GRANTS;
  return (
    <section data-testid="care-aside-sharing" aria-labelledby="care-aside-sharing-title" aria-busy={state === "loading"} className={cardCls} style={cardStyle}>
      <div className="flex items-center gap-2">
        <h2 id="care-aside-sharing-title" className="flex-1 min-w-0 flex items-center gap-2 t-base font-extrabold" style={{ color: INK }}>
          <Icon name="share" size={18} style={{ color: "var(--arbor-green-ink)" }} /> {t("elev.consult.aside.sharing")}
        </h2>
        <button type="button" data-testid="care-aside-manage" onClick={() => setActiveTab("sharing")} className="flex-shrink-0 inline-flex items-center min-h-[44px] px-2 -me-2 t-sm font-bold" style={{ color: "var(--arbor-clay)" }}>
          {t("elev.consult.aside.manage")}
        </button>
      </div>
      {state === "loading" ? (
        <p className="t-sm" style={{ color: MUTED }}>{t("elev.consult.sharing.loading")}</p>
      ) : state === "failed" ? (
        <p data-testid="care-aside-sharing-unavailable" className="t-sm" style={{ color: INK }}>{t("elev.consult.sharing.unavailable")}</p>
      ) : rows.length === 0 ? (
        <p data-testid="care-aside-sharing-none" className="t-sm" style={{ color: INK }}>{t("elev.consult.sharing.none")}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.slice(0, SHOWN_GRANTS).map((row) => (
            <li key={row.id} data-testid="care-aside-grant" className="min-w-0 t-sm border-t py-2" style={{ color: INK, borderColor: "var(--arbor-rule)" }}>
              <p className="min-w-0 flex flex-wrap items-baseline gap-x-1.5">
                <bdi dir="ltr" className="min-w-0 font-bold break-all">{row.who}</bdi>
                <span style={{ color: MUTED }}>· {t(row.roleKey)}</span>
              </p>
              <p className="t-xs" style={{ color: MUTED }}>
                {row.what.length ? row.what.join(", ") : t("sec.sharing.noScopes")}
                {row.expiresAt ? ` · ${t("sec.sharing.expires", { date: fmtDay(row.expiresAt, uiLang) })}` : ""}
              </p>
            </li>
          ))}
          {extra > 0 && <li className="t-xs border-t pt-2" style={{ color: MUTED, borderColor: "var(--arbor-rule)" }}>{t("elev.consult.sharing.more", { n: extra })}</li>}
        </ul>
      )}
    </section>
  );
}

export default function CareAside() {
  const { childProfile, setActiveTab } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const lines = useMemo(() => careSafetyLines(uiLang), [uiLang]);
  const contactsCol = useChildCollection<Contact>(childProfile.id, "contacts");
  const contact = firstDialableContact(contactsCol.items);
  const firstName = (childProfile.name || "").trim().split(" ")[0];
  const reviewed = readSafetyReviewed(childProfile.id);

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

  return (
    <aside
      data-module="consult-aside"
      aria-label={t("elev.consult.aside.label")}
      className="min-w-0 grid gap-3.5 md:grid-cols-2 xl:grid-cols-1 xl:sticky xl:top-[var(--sticky-offset)]"
    >
      <section data-testid="care-aside-safety" aria-labelledby="care-aside-safety-title" className={cardCls} style={cardStyle}>
        <div className="flex items-center gap-2.5">
          <CareGlyph icon="gpp_maybe" tone="peach" />
          <div className="min-w-0 flex-1">
            <h2 id="care-aside-safety-title" className="t-base font-extrabold" style={{ color: INK }}>{t("elev.consult.aside.safety")}</h2>
            <p data-testid="care-aside-reviewed" className="t-xs" style={{ color: MUTED }}>
              {t("elev.safety.review.last")} <strong style={{ color: INK }}>{reviewed ? fmtDay(reviewed, uiLang) : t("elev.safety.review.notYet")}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {lines.emergency && <CallLine entry={lines.emergency} />}
          {lines.talk && <CallLine entry={lines.talk} />}
          {contact && (
            <a
              data-testid="care-aside-first-contact"
              href={`tel:${contact.tel}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl px-3 py-2 min-h-[44px] t-sm font-bold"
              style={{ color: INK, border: "1px solid var(--arbor-rule)" }}
            >
              <Icon name="person" size={16} />
              <span className="min-w-0">{t("elev.safety.firstContact", { name: firstName || t("elev.safety.yourChild"), contact: contact.name || contact.phone })}</span>
              <bdi className="ms-auto" dir="ltr">{contact.phone}</bdi>
            </a>
          )}
        </div>
        {/* v3 F-CARE-1: Safety's own words for the hardest moment, in the
            readable upright body face words-to-use keep everywhere (never an
            editorial quotation), under the accent rule. */}
        <p
          data-testid="care-aside-crisis"
          className="hidden sm:block arbor-accent-rule t-base leading-relaxed"
          style={{ color: INK, fontFamily: "var(--font-sans)", fontStyle: "normal" }}
        >
          {t("elev.safety.crisis.script")}
        </p>
        {/* ONE way into Safety. When the family's region has no talk line in
            the directory, it says what Safety's by-country list is for. */}
        <button
          type="button"
          data-testid="care-aside-open-safety"
          data-find-line={lines.findLine || undefined}
          onClick={() => setActiveTab("safety")}
          className={`${secondaryCls} py-2 text-start`}
          style={secondaryStyle}
        >
          {t(lines.findLine ? "elev.safety.crisis.findLine" : "elev.consult.aside.openSafety")}
        </button>
      </section>

      <WhoSeesWhat state={sharingState} rows={rows} />
    </aside>
  );
}
