import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { PlayButton, PlayPanel } from "../ui/playkit";
import { Icon } from "../ui/Icon";
import AvatarCreator from "../profile/AvatarCreator";
import { persistHero } from "../profile/heroPersistence";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import type { AvatarResult } from "../profile/avatarGate";

/**
 * HeroFirstStep — the ONE parent-side step before Kid Mode, for a child who has
 * no hero yet (M4, kids gauntlet 22 Sep 2026).
 *
 * WHY A NEW FILE: the two existing hero-first gates are IN-PAGE panels owned by
 * their tabs (ComicsTab's RegisterShell body, HeroJourneyTab's `hero-first-gate`
 * PlayPanel). This step has to sit between a button press and Kid Mode opening,
 * so it needs a dialog of its own; it reuses their wording family (the
 * `elev.hero.step.*` keys carry exactly "First, create {name}'s hero"), their
 * primitives (Modal + PlayPanel + PlayButton), and the existing AvatarCreator
 * rather than re-implementing any of them.
 *
 * Contract:
 *  - PARENT register, calm: no verdicts, no counts, no clinical words. It is
 *    shown BEFORE Kid Mode opens and never from inside it.
 *  - The child is never blocked — "Continue with Sprout" enters Kid Mode exactly
 *    as today, and the step is offered once per session per child
 *    (heroPromptGate), so hand-over never becomes a nag.
 *  - The generated hero is written with the SAME patch shape the profile drawer
 *    uses (heroPersistence), and a failed write is said out loud instead of
 *    being swallowed.
 */
export default function HeroFirstStep({
  open,
  childId,
  childName,
  onEnterKidMode,
  onClose,
}: {
  open: boolean;
  childId: string;
  childName: string;
  /** Hand over to the child — after a hero is saved, or with Sprout. */
  onEnterKidMode: () => void;
  onClose: () => void;
}) {
  const { updateChild } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveHero = async (result: AvatarResult) => {
    setSaving(true);
    try {
      const persisted = await persistHero(childId, result, { updateChild });
      if (!persisted) {
        toast(t("elev.hero.save.failed"), "error");
        return;
      }
      onEnterKidMode();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open && !creatorOpen} onClose={onClose} title={t("elev.hero.step.title", { name: childName })}>
        <PlayPanel tone="lav" className="text-center">
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {t("elev.hero.step.body", { name: childName })}
          </p>
          <div className="flex flex-col items-center gap-3">
            <PlayButton tone="clay" onClick={() => setCreatorOpen(true)} disabled={saving}>
              <Icon name="auto_awesome" size={16} /> {t("elev.hero.step.create", { name: childName })}
            </PlayButton>
            <button
              type="button"
              data-testid="hero-step-continue"
              onClick={onEnterKidMode}
              className="rounded-xl px-5 min-h-11 text-sm font-bold"
              style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)", background: "transparent" }}
            >
              {t("elev.hero.step.continue")}
            </button>
          </div>
          <p className="text-xs mt-4 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {t("elev.storeshell.wow.sproutStars", { name: childName })}
          </p>
        </PlayPanel>
      </Modal>

      {/* The existing creator, mounted — not a second one. */}
      <AvatarCreator
        open={creatorOpen}
        childId={childId}
        childName={childName}
        onClose={() => setCreatorOpen(false)}
        onCreated={(result) => {
          setCreatorOpen(false);
          void saveHero(result);
        }}
      />
    </>
  );
}
