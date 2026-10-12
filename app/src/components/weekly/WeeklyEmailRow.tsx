import React, { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { fetchDigestEmailStatus, readEmailOptIn, writeEmailOptIn, type DigestEmailStatus } from "./recapEmail";

/**
 * v3 F-NOW-3 — the weekly-report email opt-in (W2 2.2 / N1-07), moved off
 * #/weekly when the Weekly report became the v3 mock's dashboard. It lives in
 * #/smart-reminders' Delivery section, beside the phone-reminder card: the one
 * place the parent decides what Arbor may send.
 *
 * The contract is recapEmail.ts's, unchanged: the per-account local key is the
 * render source (the switch flips instantly and offline), the server row
 * (digestOptIn/{uid}) is mirrored best-effort behind it, and the channel is
 * fail-closed — GET /api/digest/email-status decides whether a mail can go
 * at all. B-TODAY-22 (Guy G4): the row shows once the channel exists OR the
 * parent already opted in, so a parent who opted in can always opt out here
 * (and the row stays for that visit after they do).
 * While the channel is off, an opted-in parent reads the honest "not yet,
 * your choice is kept" line, set after the local write returned.
 */
export default function WeeklyEmailRow({ childFirst }: { childFirst: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const accountId = user?.uid ?? "local";

  const [optIn, setOptIn] = useState(() => readEmailOptIn(accountId));
  // Once shown, the row stays for this visit: turning the email off while the
  // channel is off never removes the switch from under the parent's finger.
  const [held, setHeld] = useState(optIn);
  useEffect(() => {
    const stored = readEmailOptIn(accountId);
    setOptIn(stored);
    if (stored) setHeld(true);
  }, [accountId]);

  const [status, setStatus] = useState<DigestEmailStatus>({ enabled: false, provider: null });
  useEffect(() => {
    let live = true;
    void fetchDigestEmailStatus().then((next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!status.enabled && !optIn && !held) return null;

  const toggle = () => {
    const next = !optIn;
    writeEmailOptIn(accountId, next);
    setOptIn(next);
    track("recap_email_optin", { on: next, channelEnabled: status.enabled });
  };

  return (
    <div
      data-testid="sr-weekly-email"
      className="mt-3 rounded-2xl p-4 flex items-center justify-between gap-4"
      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon name="mail" size={18} style={{ color: "var(--arbor-muted)", marginBlockStart: 1 }} />
        <div className="min-w-0">
          <p className="text-[13px] font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.wk.email.title")}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("elev.recap.email.desc", { name: childFirst })}</p>
          {optIn && !status.enabled && (
            <p data-testid="sr-weekly-email-soon" className="text-[12px] font-bold mt-1.5" style={{ color: "var(--arbor-ink)" }} role="status">
              {t("elev.recap.email.soon")}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optIn}
        aria-label={t("elev.recap.email.aria")}
        onClick={toggle}
        data-testid="sr-weekly-email-switch"
        className="flex-shrink-0 grid place-items-center rounded-full"
        style={{ minInlineSize: 44, minBlockSize: 44, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
      >
        <span
          aria-hidden="true"
          className="relative block rounded-full transition-colors"
          style={{ inlineSize: 44, blockSize: 26, background: optIn ? "var(--arbor-green-ink)" : "var(--arbor-rule-strong)" }}
        >
          <span
            className="absolute rounded-full"
            style={{
              inlineSize: 20,
              blockSize: 20,
              insetBlockStart: 3,
              insetInlineStart: optIn ? 21 : 3,
              background: "var(--arbor-paper-elevated)",
              boxShadow: "var(--shadow-xs)",
              transition: "inset-inline-start 0.15s",
            }}
          />
        </span>
      </button>
    </div>
  );
}
