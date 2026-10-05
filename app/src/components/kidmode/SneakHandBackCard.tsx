/**
 * B-GAME-10 — the hand-back card (PARENT register; ruling G12: the statue
 * picture is also the parent's exit picture and the share object).
 *
 * Shown after the grown-up leaves Kid Mode, when the exit recap offered it
 * (games/sneakFreeze/handBack.ts): the latest statue picture kept on the
 * device, ONE count line ("{name} reached the cat 3 times"), ONE line "Play it
 * for real tonight — in the living room, {name} is the cat", Keep (the exit
 * recap's keep action: one parent moment) and Share. Share hands the picture
 * — already rendered on the device — to the OS share sheet (lib/share
 * shareImageFile: no link, no referral call, no events, no child data in any
 * network request) and is rendered ONLY with the sandbox flag on (production
 * share waits for counsel).
 *
 * FIREWALL: no percentage, no level or band word, no catch or miss count, no
 * coloured verdict chip, no arrow or trend. Calm parent tokens, not kid toys.
 */
import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { sneakFreezeFlagOn } from "./kidWorlds";
import { dismissSneakHandBack, playRealKey, reachedKey, useSneakHandBack } from "./games/sneakFreeze/handBack";
import { readStatuePictures } from "./games/sneakFreeze/statueStore";
import { shareImageFile } from "../../lib/share";

export interface SneakHandBackViewProps {
  picture: string | null;
  pictureAlt: string;
  label: string;
  reachedLine: string;
  playRealLine: string;
  keepLabel: string;
  shareLabel: string | null;
  closeLabel: string;
  onKeep: () => void;
  onShare: () => void;
  onClose: () => void;
}

const button: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minBlockSize: 44,
  paddingInline: 16,
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  border: "1px solid var(--arbor-rule)",
  background: "var(--arbor-paper-elevated)",
  color: "var(--arbor-ink)",
};

export function SneakHandBackView(p: SneakHandBackViewProps) {
  return (
    <section
      role="dialog"
      aria-label={p.label}
      data-sneak-hand-back=""
      style={{
        position: "fixed",
        insetInline: 16,
        insetBlockEnd: "calc(16px + env(safe-area-inset-bottom, 0px))",
        zIndex: 60,
        marginInline: "auto",
        maxInlineSize: 420,
        background: "var(--arbor-paper-elevated)",
        color: "var(--arbor-ink)",
        border: "1px solid var(--arbor-rule)",
        borderRadius: "var(--r, 16px)",
        boxShadow: "var(--shadow-md, var(--shadow-xs))",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {p.picture && (
        <img data-hand-back-picture="" src={p.picture} alt={p.pictureAlt} style={{ display: "block", inlineSize: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12 }} />
      )}
      <p dir="auto" data-hand-back-reached="" style={{ margin: 0, fontWeight: 700, fontSize: 16, lineHeight: 1.35 }}>{p.reachedLine}</p>
      <p dir="auto" data-hand-back-real="" style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--arbor-ink-soft, var(--arbor-ink))" }}>{p.playRealLine}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" data-hand-back-close="" style={{ ...button, border: "none", background: "transparent" }} onClick={p.onClose}>{p.closeLabel}</button>
        {p.shareLabel && p.picture && (
          <button type="button" data-hand-back-share="" style={button} onClick={p.onShare}>{p.shareLabel}</button>
        )}
        <button type="button" data-hand-back-keep="" style={{ ...button, background: "var(--arbor-clay)", borderColor: "var(--arbor-clay)", color: "var(--arbor-paper-elevated)" }} onClick={p.onKeep}>{p.keepLabel}</button>
      </div>
    </section>
  );
}

/** Mounted by KidModeProvider only while Kid Mode is CLOSED. */
export default function SneakHandBackCard() {
  const card = useSneakHandBack();
  const { addMoment } = useArbor();
  const { t } = useLanguage();
  if (!card) return null;
  const picture = readStatuePictures(card.childId)[0]?.url ?? null;
  const reachedLine = t(reachedKey(card.name, card.gender, card.reached), { name: card.name, count: card.reached });
  const keep = card.keepLine ?? reachedLine;
  return (
    <SneakHandBackView
      picture={picture}
      pictureAlt={card.name ? t("handBack.sneakFreeze.pictureAlt", { name: card.name }) : t("handBack.sneakFreeze.pictureAlt.noName")}
      label={t("handBack.sneakFreeze.label")}
      reachedLine={reachedLine}
      playRealLine={t(playRealKey(card.name, card.gender), { name: card.name })}
      keepLabel={t("elev.learnCare.kidExit.keep")}
      shareLabel={sneakFreezeFlagOn() ? t("handBack.sneakFreeze.share") : null}
      closeLabel={t("aria.close")}
      onKeep={() => { addMoment(keep); dismissSneakHandBack(); }}
      onShare={() => { if (picture) void shareImageFile({ dataUrl: picture, filename: "statue.jpg" }); }}
      onClose={dismissSneakHandBack}
    />
  );
}
