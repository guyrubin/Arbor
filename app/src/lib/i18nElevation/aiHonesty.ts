/* i18nElevation/aiHonesty — Wave T lane A (2026-09-03): honest-AI copy on the
 * Ask Arbor coach surface.
 *
 *  - AI-13: the coach identity strip said "AI guide · always here" beside a
 *    filled green dot — the universal "online now" affordance, read as a
 *    person on shift (Law 4: no fake presence). Keep the honest half only:
 *    "AI guide". (`coach.coachStatus` in lib/i18n.ts is shared and stays
 *    allow-listed for the Art. 50 disclosure; CoachTab now reads this key.)
 *  - AI-23: the Ask hero always claimed "Uses the memory you approved about
 *    {name}" — on day 0 there is no approved fact, so the line promised what
 *    Arbor could not yet keep and the TrustPanel below contradicted it. The
 *    copy is count-aware now: 0 → Arbor will ask first; n → grounded in n.
 *
 * Register: parent, calm, plural Israeli-parent address; "בינה מלאכותית" is
 * the honest disclosure term (allowed by i18n.jargon.test.ts), never the
 * marketing framing. */

export const en: Record<string, string> = {
  "elev.aihonesty.coachStatus": "AI guide",
  "elev.aihonesty.memory.none": "Arbor will ask before remembering anything about {name}",
  "elev.aihonesty.memory.one": "Grounded in 1 fact you approved about {name} · you control what is remembered",
  "elev.aihonesty.memory.some": "Grounded in {n} facts you approved about {name} · you control what is remembered",
};

export const he: Record<string, string> = {
  "elev.aihonesty.coachStatus": "עוזר בינה מלאכותית",
  "elev.aihonesty.memory.none": "ארבור ישאל לפני שיזכור משהו על {name}",
  "elev.aihonesty.memory.one": "מבוסס על עובדה אחת שאישרתם על {name} · אתם שולטים במה שנשמר",
  "elev.aihonesty.memory.some": "מבוסס על {n} עובדות שאישרתם על {name} · אתם שולטים במה שנשמר",
};
