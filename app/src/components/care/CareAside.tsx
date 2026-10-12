import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
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
       of claiming no one has access. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const SHOWN_GRANTS = 3;

type Contact = { id: string; name: string; phone: string };
type Roster = { state: "loading" } | { state: "failed" } | { state: "ready"; grants: ShareGrant[] };

const cardCls = "min-w-0 rounded-[var(--r-lg)] border p-4 flex flex-col gap-3";
const cardStyle: React.CSSProperties = { borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)" };
const secondaryCls = "self-start inline-flex items-center justify-center gap-1.5 rounded-xl px-4 min-h-[44px] t-sm font-bold";
const secondaryStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: INK, border: "1px solid var(--arbor-rule)" };

function CallLine({ entry }: { entry: HelplineEntry }) {
  const { t } = useLanguage();
  return (
    <a
      data-testid="care-aside-call"
      data-line={entry.id}
      href={`tel:${entry.tel}`}
      className="flex items-start gap-3 rounded-xl px-3 py-2 min-h-[44px] text-start"
      style={{ background: "var(--arbor-paper-deep)", color: INK }}
    >
      <Icon name="call" size={18} className="mt-0.5 flex-shrink-0" />
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
      <h2 id="care-aside-sharing-title" className="flex items-center gap-2 t-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
        <Icon name="share" size={18} /> {t("elev.consult.aside.sharing")}
      </h2>
      {state === "loading" ? (
        <p className="t-sm" style={{ color: MUTED }}>{t("elev.consult.sharing.loading")}</p>
      ) : state === "failed" ? (
        <p data-testid="care-aside-sharing-unavailable" className="t-sm" style={{ color: INK }}>{t("elev.consult.sharing.unavailable")}</p>
      ) : rows.length === 0 ? (
        <p data-testid="care-aside-sharing-none" className="t-sm" style={{ color: INK }}>{t("elev.consult.sharing.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.slice(0, SHOWN_GRANTS).map((row) => (
            <li key={row.id} data-testid="care-aside-grant" className="min-w-0 t-sm" style={{ color: INK }}>
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
          {extra > 0 && <li className="t-xs" style={{ color: MUTED }}>{t("elev.consult.sharing.more", { n: extra })}</li>}
        </ul>
      )}
      <button type="button" data-testid="care-aside-manage" onClick={() => setActiveTab("sharing")} className={secondaryCls} style={secondaryStyle}>
        {t("elev.consult.aside.manage")}
      </button>
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
      className="min-w-0 grid gap-4 md:grid-cols-2 min-[1600px]:grid-cols-1 min-[1600px]:sticky min-[1600px]:top-[var(--sticky-offset)]"
    >
      <section data-testid="care-aside-safety" aria-labelledby="care-aside-safety-title" className={cardCls} style={cardStyle}>
        <h2 id="care-aside-safety-title" className="flex items-center gap-2 t-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
          <Icon name="gpp_maybe" size={18} /> {t("elev.consult.aside.safety")}
        </h2>
        <div className="flex flex-col gap-2">
          {lines.emergency && <CallLine entry={lines.emergency} />}
          {lines.talk && <CallLine entry={lines.talk} />}
          {lines.findLine && (
            <button
              type="button"
              data-testid="care-aside-find-line"
              onClick={() => setActiveTab("safety")}
              className="flex items-center rounded-xl px-3 min-h-[44px] t-sm font-bold text-start"
              style={{ color: INK, border: "1px solid var(--arbor-rule)" }}
            >
              {t("elev.safety.crisis.findLine")}
            </button>
          )}
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
        <p data-testid="care-aside-reviewed" className="t-xs" style={{ color: MUTED }}>
          {t("elev.safety.review.last")} <strong style={{ color: INK }}>{reviewed ? fmtDay(reviewed, uiLang) : t("elev.safety.review.notYet")}</strong>
        </p>
        <button type="button" data-testid="care-aside-open-safety" onClick={() => setActiveTab("safety")} className={secondaryCls} style={secondaryStyle}>
          {t("elev.consult.aside.openSafety")}
        </button>
      </section>

      <WhoSeesWhat state={sharingState} rows={rows} />
    </aside>
  );
}
