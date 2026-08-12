# Maytal Concept Mockup → Build Translation

**Source:** PNG attached to Maytal Doron's 2026-08-04 email (12 phone-frame concepts, two rows). Retrieved 2026-08-11; copy at the session scratchpad; original stays in Gmail.
**Purpose:** binding visual reference for masterplan Waves 1–3 builds. Where the mockup conflicts with the clinical firewall, the translation below wins (she was told "no scores" is a product law — the mockups are directional, not literal).

## Row 1 — "Reasons to return in week 2" (6 frames)

| # | Her frame | Plan item | Build translation | Firewall delta |
|---|-----------|-----------|-------------------|----------------|
| 1 | "מה חדש מאז הביקור האחרון" — warm greeting ("מיכל טוב 👋 שמחנו לראות אותך שוב"), card "חדש מאז הביקור האחרון" with 3 rows (new matched activities · milestone completed · 2–3 progress items), then "ממשיך מאיפה שהפסקנו" with a resume-activity card | 1.1 SinceLastVisit | Adopt structure verbatim: greeting acknowledges return + strip of ≤3 event rows, each tappable deep-link; a "continue where we left off" resume card BELOW the strip (this is the guaranteed-action slot when a prior activity exists) | Rows are EVENTS ("milestone completed"), never deltas ("faster than…") — her frame is already compliant |
| 2 | Weekly Insight — purple hero "מה הולך טוב ❤️" + per-domain rows WITH TREND ARROWS + CTA "לכל התובנות וההמלצות" | 2.1 recap | Hero card + domain rows + one CTA — keep. | Trend arrows on child domains are BANNED (trend deltas). Replace with count chips ("3 מילים חדשות", "5 רגעים") — activity evidence, not direction |
| 3 | Timeline "הדרך של אביגיל" — toggle [אבני דרך | ציר זמן], vertical spine with today/3d/1w/2w/3w event nodes, CTA "לכל הדרך" | 1.8 months layer | The toggle (Milestones \| Timeline) maps to the existing Journal/Story density switch; adopt her vertical-spine visual for StoryTimeline's month layer; event nodes = crossings + captured moments | Nodes are events — compliant as-is |
| 4 | "הסיכום שלי לשבוע זה" — exactly 3 blocks: התקדמות (progress) / מומלץ להמשיך (keep doing) / לשים לב (worth attention), then "מה תרצי לעשות עכשיו?" 4 quick actions | 2.1 recap cards | The 3-block shape = the recap's story cards; "לשים לב" block phrased observationally ("שווה שיחה" language, never warning colors); quick-action row = recap's final card is ONE primary recommendation (plan rule) + smaller secondary links | Orange "attention" block → neutral tone + conversation framing |
| 5 | "ממשיך מכאן" — photo of last activity, "הבא בתור" continuation recommendation + "עוד בשביל אביגיל" list | 2.5 continuation | Adopt: continuation card cites the parent's own last report ("אמרת שזה עזר → הצעד הבא") + next-step activity; "more for {child}" = ranked list | Attribution = parent's report, never AI efficacy claim |
| 6 | Lock-screen notification + mascot: "היום יש תובנה חדשה בשבילכם 💚 …" "פתחו את Arbor ותגלו מה חדש" | 2.2 channel | v1 = email digest (no push infra yet); subject/preheader copy adopts her notification voice; mascot art exists (ArborMascot) | Content counts-only in email |

## Row 2 — Explainability & Trust (6 frames)

| # | Her frame | Plan item | Build translation |
|---|-----------|-----------|-------------------|
| 1 | "למה קיבלתי את ההמלצה הזו?" — panel: based on age 18m · completed 3 similar activities · progress in colors · interest in sorting; purpose line "לחזק מוטוריקה עדינה…" | 3.1 why-panel | The expanded "why" sheet behind every inline why-line: 3–4 plain factors + one purpose sentence. Factors from real inputs (age band, done activities, parent-logged interests) |
| 2 | "איך Arbor עובד?" — prose + list of data used (age, what you shared, activities done, screening, scientific base) + green lock "המידע שלכם מאובטח" | 3.3 + 3.2 | = TrustPanel content model, verbatim structure. The lock line ships as-is |
| 3 | "מה המשמעות של כל סימן?" — legend with green/orange/gray/red status dots | 3.3 legend | KEEP the legend screen, DROP the traffic-light semantics: Arbor's actual signals are counts/observations, so the legend explains OUR marks (checked milestone, watch-signal = "שווה שיחה", moment provenance You/Arbor/child). A red "needs attention" tier does not exist in-product and must not be invented for the legend |
| 4 | "מה Arbor לא עושה" — X-list: not a diagnosis, not a professional substitute, no medical decisions, no data selling | 3.3 | Ship verbatim — this is the strongest trust frame she drew. Align copy with existing TrustSafetyBar language |
| 5 | "מאיפה המידע?" — AAP, WHO, peer-reviewed research, expert team | 3.4 provenance | AAP/WHO/research rows ship now (research-anchored true claims); "צוות מומחים" row ONLY after GD-10 names the reviewer — fail-closed, omit until then |
| 6 | Trust Center — one hub listing: how Arbor works / what data / what signs mean / FAQ / privacy / contact | 3.3 trust center | = the Science page rewrite IA: exactly these 6 rows, each → section. Every inline why-line links here |

## Visual language (both rows)
Calm violet/lavender accent on white cards, soft ~16–20px radii, generous whitespace, one emoji-warmth touch per screen max, status icons in soft chips, single primary CTA per screen (full-width, bottom). This matches the flat clinical register — use existing tokens (`--arbor-lav*`, kit Chip/IconBadge/SectionCard); NO new hex values (GD-1/GD-2 locked). Her 4-tab bottom nav (בית/ספרייה/מעקב/עוד) roughly matches the existing 4+More MobileNav — no nav rebuild implied.
