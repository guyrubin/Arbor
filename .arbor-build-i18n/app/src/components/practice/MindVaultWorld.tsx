import React from "react";
import { useArbor } from "../../context/ArborContext";
import { usePracticeData } from "../../practice/usePracticeData";
import MemoryMatch from "./MemoryMatch";

/* Mind Vault world — the memory-match game, given its own Hero Arcade entry.
   Supplies the practice data + child age that MemoryMatch needs (it was
   previously only reachable nested inside Story Quest). */

export default function MindVaultWorld() {
  const { childProfile } = useArbor();
  const data = usePracticeData(childProfile.id);
  return <MemoryMatch data={data} childAge={childProfile.age} />;
}
