import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDay } from "../../lib/formatDate";
import { careSafetyLines, firstDialableContact, readSafetyReviewed } from "../../safety/safetyLines";
import type { HelplineEntry } from "../../safety/escalation";

/* v3 EXTRA-CARE — the Care landing's aside: Help and safety, always visible.
   The emergency line and the family's talk line as plain tel: links from
   Safety's own directory and selection, the family's first saved contact,
   and when Safety was last reviewed on this device. Safety's one-tap call
   stays Safety's primary move; nothing here carries the route's move, so
   Care keeps its single build-share-packet act.
   v4 (Care is one screen): with the Care pills gone this card is the page's
   way into #/safety; "Who sees what" moved beside Past exports (CareShared). */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";

type Contact = { id: string; name: string; phone: string };

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

export default function CareAside() {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const lines = useMemo(() => careSafetyLines(uiLang), [uiLang]);
  const contactsCol = useChildCollection<Contact>(childProfile.id, "contacts");
  const contact = firstDialableContact(contactsCol.items);
  const firstName = (childProfile.name || "").trim().split(" ")[0];
  const reviewed = readSafetyReviewed(childProfile.id);

  return (
    <aside
      data-module="consult-aside"
      aria-label={t("elev.consult.aside.label")}
      className="min-w-0 min-[1600px]:sticky min-[1600px]:top-[var(--sticky-offset)]"
    >
      <section data-testid="care-aside-safety" aria-labelledby="care-aside-safety-title" className={cardCls} style={cardStyle}>
        <h2 id="care-aside-safety-title" className="flex items-center gap-2 t-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>
          <Icon name="gpp_maybe" size={18} /> {t("elev.consult.aside.safety")}
        </h2>
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
        <p data-testid="care-aside-reviewed" className="t-xs" style={{ color: MUTED }}>
          {t("elev.safety.review.last")} <strong style={{ color: INK }}>{reviewed ? fmtDay(reviewed, uiLang) : t("elev.safety.review.notYet")}</strong>
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

    </aside>
  );
}
