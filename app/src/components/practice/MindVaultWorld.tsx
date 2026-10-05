import React from "react";
import { useArbor } from "../../context/ArborContext";
import { usePracticeData } from "../../practice/usePracticeData";
import MemoryMatch from "./MemoryMatch";
import { GameShell } from "../kidmode/game/GameShell";
import { useLanguage } from "../../context/LanguageContext";

/* Mind Vault world — the memory-match game, given its own Hero Arcade entry.
   Supplies the practice data + child age that MemoryMatch needs (it was
   previously only reachable nested inside Story Quest). */

export default function MindVaultWorld() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  return (
    // B-KID-74: the one kid game shell (Kid Mode: the overlay bar names the
    // game, hear-it replays the instruction; the parent door keeps PlayHeader).
    <GameShell
      worldId="memory"
      title={t("elev.kids.memory.title")}
      instruction={t("elev.kids.memory.say")}
      mood="think"
      eyebrow={t("elev.kids.mission")}
    >
      <MemoryMatch data={data} childAge={childProfile.age} embedded />
    </GameShell>
  );
}
