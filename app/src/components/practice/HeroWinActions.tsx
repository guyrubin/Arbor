import React, { useState } from "react";
import { Camera, Share2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PlayButton } from "../ui/playkit";

export default function HeroWinActions({ worldName, winLine }: { worldName: string; winLine?: string }) {
  const { childProfile, setActiveTab } = useArbor();
  const { aiLang } = useLanguage();
  const [shared, setShared] = useState(false);
  const first = childProfile.name.split(" ")[0] || "Your hero";
  const he = aiLang === "he";

  const shareWin = async () => {
    if (typeof window === "undefined") return;
    const text = winLine ?? (he
      ? `${first} השלים/ה את ${worldName} ב-Arbor ובנה/בנתה מיומנות צמיחה אמיתית.`
      : `${first} completed ${worldName} in Arbor and built a real growth skill.`);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Arbor hero win", text, url: window.location.origin });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShared(false);
    }
  };

  return (
    <>
      <PlayButton tone="yellow" onClick={() => setActiveTab("comics")}>
        <Camera className="w-4 h-4" aria-hidden="true" /> {he ? "הפוך לקומיקס" : "Turn into comic"}
      </PlayButton>
      <PlayButton variant="soft" tone="sky" onClick={() => void shareWin()}>
        <Share2 className="w-4 h-4" aria-hidden="true" /> {shared ? (he ? "הניצחון הועתק" : "Win copied") : (he ? "שתף ניצחון" : "Share win")}
      </PlayButton>
    </>
  );
}
