import React from "react";
import { motion } from "motion/react";
import { Languages, Sparkles, MessageSquare } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, cardCls, Chip, PastelKey } from "../ui/kit";

/**
 * Language Lab — multilingual development support, driven by the child's own
 * `languages` profile (not hard-coded). Home language = first listed, the
 * "second language" we help build = second listed, the rest are early exposure.
 */
export default function LanguageLabTab() {
  const { childProfile, setChatInput, setSelectedLens, setActiveTab } = useArbor();
  const name = childProfile.name;
  const first = name.split(" ")[0];
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
      tone: "mint" as PastelKey,
    },
    second && {
      label: "Second language",
      value: second,
      note: "Developing — likely understands more than they produce. Build confidence with low-pressure, daily practice.",
      tag: "Emerging",
      tone: "yellow" as PastelKey,
    },
    ...others.map((o) => ({
      label: "Additional language",
      value: o,
      note: "Early exposure — keep it playful and optional. No pressure to produce yet.",
      tag: "Exposure",
      tone: "sky" as PastelKey,
    })),
  ].filter(Boolean) as { label: string; value: string; note: string; tag: string; tone: PastelKey }[];

  const activities = [
    {
      title: "Morning phrase card",
      time: "2 min",
      desc: `One short ${target} sentence ${first} can actually use today. Practice it together at breakfast.`,
      example: '"Can I play with you?" · "Where do I put my bag?" · "I need help, please."',
      lens: "Vygotsky · ZPD",
    },
    {
      title: "Translator game",
      time: "5 min",
      desc: `Say a sentence in ${home || "the home language"}; ${first} translates it into ${target}. Celebrate attempts, not perfection.`,
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
      desc: `Follow ${first}'s lead on any ${target} bid — if they offer one word, extend it into a sentence back. Don't correct, expand.`,
      example: `${first}: "car" → you: "yes — the red car is going really fast!"`,
      lens: "Harvard Center · S&R",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Child Intelligence"
        title="Language & Communication"
        subtitle={`Multilingual support for ${first} — a calm daily practice built around the languages spoken at home.`}
      />

      {langs.length === 0 ? (
        <div className={`${cardCls} p-8 text-center space-y-3`}>
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>
            No languages set for {first} yet. Add the languages spoken at home in their profile, and the daily practice
            below will personalize to them.
          </p>
          <button
            onClick={() => setActiveTab("profile")}
            className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
            style={{ background: "#e4f4ec", color: "#1f8a5a" }}
          >
            Edit {first}&apos;s profile
          </button>
        </div>
      ) : (
        <>
          {/* Language profile */}
          <SectionCard title={`Language profile — ${first} · Age ${childProfile.age}`} icon={<Languages className="w-5 h-5" />} tone="sky">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {profileCards.map((c, i) => (
                <div key={i} className={`${cardCls} p-4 space-y-2`}>
                  <span className="text-[10px] uppercase font-bold tracking-wide block" style={{ color: "var(--arbor-muted)" }}>{c.label}</span>
                  <b className="block text-sm" style={{ color: "var(--arbor-ink)" }}>{c.value}</b>
                  <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.note}</p>
                  <Chip tone={c.tone}>{c.tag}</Chip>
                </div>
              ))}
            </div>
            {!second && (
              <p className="text-[11px] italic mt-4" style={{ color: "var(--arbor-muted)" }}>
                Only one language is set for {first}. Add a second language in their profile to unlock the bilingual
                practice routines below.
              </p>
            )}
          </SectionCard>

          {/* Daily practice */}
          <SectionCard
            title={`${target} activation routines`}
            icon={<Sparkles className="w-5 h-5" />}
            tone="mint"
            action={
              <button
                onClick={() =>
                  askCoach(
                    `Give me a gentle one-week plan to build ${name}'s (age ${childProfile.age}) confidence in ${target}, with ${home || "the home language"} as the home language. Keep it low-pressure, play-based, and non-diagnostic — a few minutes a day.`
                  )
                }
                className="inline-flex items-center justify-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                style={{ background: "#e4f4ec", color: "#1f8a5a" }}
              >
                <Sparkles className="w-3.5 h-3.5" /> Ask for a week plan
              </button>
            }
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: "#1f8a5a" }}>Daily practice · Vygotsky ZPD</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {activities.map((item) => (
                <div key={item.title} className={`${cardCls} p-4 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <b style={{ color: "var(--arbor-ink)" }}>{item.title}</b>
                    <Chip tone="yellow">{item.time}</Chip>
                  </div>
                  <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.desc}</p>
                  <p className="italic rounded-xl p-2 text-[11px]" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
                    {item.example}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#1f8a5a" }}>{item.lens}</span>
                    <button
                      onClick={() =>
                        askCoach(
                          `Help me run the "${item.title}" ${target} activity with ${name} (age ${childProfile.age}) today. Give me a 3-step script and one way to make it easier if they resist.`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-bold transition"
                      style={{ color: "var(--arbor-muted)" }}
                    >
                      <MessageSquare className="w-3 h-3" /> Coach me
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </motion.div>
  );
}
