import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { HOME_PROGRAM_SCOPE_ID, HOME_PROGRAM_SCOPE_SERVER_READY, grantsHomeProgram } from "../../lib/shareScopes";
import { activeHomeEnrolments, type HomeProgramEnrolment } from "../../content/programs/homeProgram";

/**
 * B-PROG-09 (read link, client) — the professional's read-only link to the
 * home program, CLIENT SIDE ONLY.
 *
 *  - The grant: "Share the home program" on Care › Sharing (TrustedSharing),
 *    one consent sentence (EN + HE), revocable from the same card. It sends a
 *    `professional` grant whose ONLY scope is `home-program-adherence`, until
 *    revoked (server-enforced expiry/revocation, src/sharing/shares.ts).
 *  - The page: the shared viewer renders `HomeProgramAdherenceView` — ONLY the
 *    home program's section (practice days as counts, the goals in the
 *    family's words), nothing else — when the SERVER's resolved scopes for the
 *    grant (`view.scopes`, grantScopes → fail-closed normalizeScopes) carry
 *    the scope.
 *
 * GATE (never a dead or an open door): the scope is NOT in SHARE_SCOPE_IDS yet,
 * so today's server drops it (normalizeScopes fails closed → a grant with no
 * recognised scope → 403 on the shared view) and never returns it in
 * `view.scopes`, so the page cannot render. The grant card is OFF until
 * `HOME_PROGRAM_SCOPE_SERVER_READY` flips with the server residue (REJECTIONS
 * P6-PRACTICE 8 Oct, "B-PROG-09 — the read link's server side"); after that the
 * device flag below opens it for the pilot. No professional account, no model call.
 */

export const HOME_PROGRAM_LINK_FLAG_KEY = "arbor.flags.homeProgramLink";

type StorageLike = Pick<Storage, "getItem"> | null | undefined;
const deviceStorage = (): StorageLike => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Is the grant card on? Only when the server enforces the scope AND the pilot flag is set. Fails closed. */
export function homeProgramLinkOn(args: { serverReady?: boolean; storage?: StorageLike } = {}): boolean {
  const ready = args.serverReady === undefined ? HOME_PROGRAM_SCOPE_SERVER_READY : args.serverReady;
  if (!ready) return false;
  const storage = args.storage === undefined ? deviceStorage() : args.storage;
  try {
    return storage?.getItem(HOME_PROGRAM_LINK_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** The shared viewer's mode, from the scopes the SERVER resolved for the grant. */
export function sharedViewMode(view: { scopes: readonly string[] }): "home-program" | "packet" {
  return grantsHomeProgram(view.scopes) ? "home-program" : "packet";
}

/** The ONE section the home-program page renders (consult/packet buildIntakePacket). */
export const HOME_PROGRAM_SECTION_ID = "intake-home-program";

interface SharedSection { id: string; title?: string; items: ReadonlyArray<{ id: string; text: string }> }

/** The read-only adherence page: the home program's section ONLY. */
export function HomeProgramAdherenceView({ view }: { view: { scopes: readonly string[]; sections: readonly SharedSection[] } }) {
  const { t } = useLanguage();
  if (sharedViewMode(view) !== "home-program") return null;
  const section = view.sections.find((s) => s.id === HOME_PROGRAM_SECTION_ID);
  return (
    <section data-testid="home-program-view" className="flex flex-col gap-2">
      <h3 className="t-base font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.pro.line")}</h3>
      <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.view.readOnly")}</p>
      {section && section.items.length ? (
        <ul>
          {section.items.map((it) => (
            <li key={it.id} data-testid="home-program-view-line" className="border-t py-2 first:border-t-0 t-sm leading-relaxed" style={{ borderColor: "var(--arbor-rule)", color: "var(--arbor-ink)" }}>
              <bdi dir="auto">{it.text}</bdi>
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.view.empty")}</p>
      )}
    </section>
  );
}

export interface HomeProgramGrant { id: string; recipientEmail: string; scopes: string[] }

const FIELD: React.CSSProperties = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const SAVE: React.CSSProperties = { background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" };

/** The grant card body (pure props — the card mounts it with the active home programs). */
export function HomeProgramShareBody({ programs, grants, busy, onGrant, onRevoke }: {
  programs: readonly HomeProgramEnrolment[];
  grants: readonly HomeProgramGrant[];
  busy: string | null;
  onGrant: (email: string) => void;
  onRevoke: (grant: HomeProgramGrant) => void;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  if (!programs.length) return null;
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  const live = grants.filter((g) => grantsHomeProgram(g.scopes));
  return (
    <section data-testid="home-program-share" className="border-y py-4 flex flex-col gap-2" style={{ borderColor: "var(--arbor-rule)" }}>
      <h2 className="t-base font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.share.title")}</h2>
      <p data-testid="home-program-share-consent" className="t-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.homeProgram.share.consent")}</p>
      <label htmlFor="home-program-share-email" className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.share.email")}</label>
      <input id="home-program-share-email" data-testid="home-program-share-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 px-3 t-base" style={FIELD} />
      <button
        type="button"
        data-testid="home-program-share-send"
        disabled={!valid || busy === "home-program"}
        onClick={() => { onGrant(email.trim()); setEmail(""); }}
        className="inline-flex min-h-11 items-center self-start rounded-full px-4 t-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
        style={SAVE}
      >
        {t("elev.homeProgram.share.send")}
      </button>
      {live.length > 0 && (
        <ul className="mt-1">
          {live.map((g) => (
            <li key={g.id} data-testid="home-program-share-grant" className="flex flex-wrap items-center justify-between gap-2 border-t py-2" style={{ borderColor: "var(--arbor-rule)" }}>
              <span className="t-sm" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.share.active", { email: g.recipientEmail })}</span>
              <button type="button" data-testid="home-program-share-stop" disabled={busy === g.id} onClick={() => onRevoke(g)} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-semibold" style={QUIET}>
                {t("elev.homeProgram.share.stop")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The grant card — mounted by TrustedSharing ONLY when `homeProgramLinkOn()`. */
export default function HomeProgramShareCard(props: { childId: string; grants: readonly HomeProgramGrant[]; busy: string | null; onGrant: (email: string) => void; onRevoke: (grant: HomeProgramGrant) => void }) {
  const programs = useChildCollection<HomeProgramEnrolment>(props.childId, "programs");
  return <HomeProgramShareBody programs={activeHomeEnrolments(programs.items)} grants={props.grants} busy={props.busy} onGrant={props.onGrant} onRevoke={props.onRevoke} />;
}

export { HOME_PROGRAM_SCOPE_ID };
