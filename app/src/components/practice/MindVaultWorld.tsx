import React from "react";
import { useArbor } from "../../context/ArborContext";
import { usePracticeData } from "../../practice/usePracticeData";
import MemoryMatch from "./MemoryMatch";
import { PlayHeader } from "../ui/playkit";
import { useLanguage } from "../../context/LanguageContext";

/* Mind Vault world — the memory-match game, given its own Hero Arcade entry.
   Supplies the practice data + child age that MemoryMatch needs (it was
   previously only reachable nested inside Story Quest). */

export default function MindVaultWorld() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  return (
    <div className="space-y-6">
      <PlayHeader
        title={t("elev.kids.memory.title")}
        say={t("elev.kids.memory.say")}
        mood="think"
        worldId="memory"
        variant="compact"
        eyebrow={t("elev.kids.mission")}
      />
      <MemoryMatch data={data} childAge={childProfile.age} embedded />
    </div>
  );
}
