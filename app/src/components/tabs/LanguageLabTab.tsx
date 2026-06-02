import React from "react";
import { motion } from "motion/react";
import { Languages, Sparkles, MessageSquare } from "lucide-react";
import { useArbor } from "../../context/ArborContext";

/**
 * Language Lab — multilingual development support, driven by the child's own
 * `languages` profile (not hard-coded). Home language = first listed, the
 * "second language" we help build = second listed, the rest are early exposure.
 */
export default function LanguageLabTab() {
  const { childProfile, setChatInput, setSelectedLens, setActiveTab } = useArbor();
  const name = childProfile.name;
  const langs = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const home = langs[0];
  const second = langs[1];
  const others = langs.slice(2);
  const target = second || "their second language";

  const askCoach = (prompt: string) => {
    setSelectedLens("Lev Vygotsky");
    setChatInput(prompt);
    setActiveTab("coach");
  };

  const profileCards = [
    home && {
      label: "Home language",
      value: home,
      note: "Dominant language — full fluency in familiar domains. Keep it rich; it anchors everything else.",
      tag: "Native",
      tagClass: "bg-green-500/15 text-green-400",
    },
    second && {
      label: "Second language",
      value: second,
      note: "Developing — likely understands more than they produce. Build confidence with low-pressure, daily practice.",
      tag: "Emerging",
      tagClass: "bg-amber-500/15 text-[#f4d991]",
    },
    ...others.map((o) => ({
      label: "Additional language",
      value: o,
      note: "Early exposure — keep it playful and optional. No pressure to produce yet.",
      tag: "Exposure",
      tagClass: "bg-white/10 text-gray-400",
    })),
  ].filter(Boolean) as { label: string; value: string; note: string; tag: string; tagClass: string }[];

  const activities = [
    {
      title: "Morning phrase card",
      time: "2 min",
      desc: `One short ${target} sentence ${name} can actually use today. Practice it together at breakfast.`,
      example: '"Can I play with you?" · "Where do I put my bag?" · "I need help, please."',
      lens: "Vygotsky · ZPD",
    },
    {
      title: "Translator game",
      time: "5 min",
      desc: `Say a sentence in ${home || "the home language"}; ${name} translates it into ${target}. Celebrate attempts, not perfection.`,
      example: "Start with feelings: angry, scared, hungry, tired, happy. Body words first, then school words.",
      lens: "Vygotsky · Piaget",
    },
    {
      title: `Bedtime story in ${target}`,
      time: "10 min",
      desc: `Read one book in ${target}. Narrate slowly, point at pictures, and ask one open question after.`,
      example: '"What do you think happened just before the story started?"',
      lens: "Serve & Return",
    },
    {
      title: "Serve & return",
      time: "Daily",
      desc: `Follow ${name}'s lead on any ${target} bid — if they offer one word, extend it into a sentence back. Don't correct, expand.`,
      example: `${name}: "car" → you: "yes — the red car is going really fast!"`,
      lens: "Harvard Center · S&R",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Languages className="w-7 h-7 text-[#d7aa55]" /> Language Lab
        </h2>
        <p className="text-sm text-[#a8a093] mt-1">
          Multilingual support for {name} — a calm daily practice built around the languages spoken at home.
        </p>
      </div>

      {langs.length === 0 ? (
        <div className="bg-[#141821] border border-white/10 rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm text-[#a8a093]">
            No languages set for {name} yet. Add the languages spoken at home in their profile, and the daily practice
            below will personalize to them.
          </p>
          <button
            onClick={() => setActiveTab("overview")}
            className="inline-flex items-center gap-2 bg-[#d7aa55]/10 border border-[#d7aa55]/25 hover:bg-[#d7aa55]/20 text-[#f4d991] font-bold text-xs px-4 py-2.5 rounded-xl transition"
          >
            Edit {name}&apos;s profile
          </button>
        </div>
      ) : (
        <>
          {/* Language profile */}
          <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-5">
            <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-widest block">
              Language profile — {name} · Age {childProfile.age}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {profileCards.map((c, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#a8a093] tracking-wide block">{c.label}</span>
                  <b className="text-white block text-sm">{c.value}</b>
                  <p className="text-[#a8a093] leading-relaxed">{c.note}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${c.tagClass}`}>{c.tag}</span>
                </div>
              ))}
            </div>
            {!second && (
              <p className="text-[11px] text-[#a8a093] italic">
                Only one language is set for {name}. Add a second language in their profile to unlock the bilingual
                practice routines below.
              </p>
            )}
          </div>

          {/* Daily practice */}
          <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-widest block">
                  Daily practice — Vygotsky ZPD
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{target} activation routines</h3>
              </div>
              <button
                onClick={() =>
                  askCoach(
                    `Give me a gentle one-week plan to build ${name}'s (age ${childProfile.age}) confidence in ${target}, with ${home || "the home language"} as the home language. Keep it low-pressure, play-based, and non-diagnostic — a few minutes a day.`
                  )
                }
                className="inline-flex items-center justify-center gap-2 bg-[#d7aa55]/10 border border-[#d7aa55]/25 hover:bg-[#d7aa55]/20 text-[#f4d991] font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> Ask the coach for a week plan
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {activities.map((item) => (
                <div key={item.title} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <b className="text-white">{item.title}</b>
                    <span className="text-[10px] bg-[#d7aa55]/15 text-[#f4d991] px-2 py-0.5 rounded-full font-bold">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-[#a8a093] leading-relaxed">{item.desc}</p>
                  <p className="text-white/60 italic bg-white/[0.02] border border-white/5 rounded-xl p-2 text-[11px]">
                    {item.example}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#d7aa55]/80 font-bold uppercase tracking-wide">{item.lens}</span>
                    <button
                      onClick={() =>
                        askCoach(
                          `Help me run the "${item.title}" ${target} activity with ${name} (age ${childProfile.age}) today. Give me a 3-step script and one way to make it easier if they resist.`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a8a093] hover:text-[#f4d991] transition"
                    >
                      <MessageSquare className="w-3 h-3" /> Coach me
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
