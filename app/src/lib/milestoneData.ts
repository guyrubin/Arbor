import { Milestone, MilestoneSource } from "../types";
import { resolveHebrewSlash } from "./hebrewSlashGender";
import { toAgeBand, type CanonicalBandId } from "./domains/ageBands";

/**
 * CDC / AAP-2022 developmental milestone checklists (Zubler et al., *Pediatrics*
 * 2022;149(3):e2021052138 — "Evidence-Informed Milestones for Developmental
 * Surveillance Tools"). The 2022 revision shifted CDC's "Learn the Signs. Act
 * Early." milestones to the **75th-percentile** standard — i.e. the age by which
 * MOST (≈75%+) children can do the skill — and added checkpoints at 15 and 30
 * months, giving 12 checklists across the well-child schedule:
 *
 *   2m, 4m, 6m, 9m, 12m, 15m, 18m, 24m, 30m, 3y, 4y, 5y  (≈159 milestones).
 *
 * Each milestone is tagged to one of the four CDC developmental domains, mapped
 * onto Arbor's six-domain framework:
 *   Social/Emotional      → social_development / attachment_regulation
 *   Language/Communication → language_communication
 *   Cognitive             → cognition_executive_function
 *   Movement/Physical     → sensory_motor_patterns (+ self-help → independence)
 *
 * Communication & feeding detail is cross-checked against ASHA's 2023
 * "Communication Milestones" and feeding/swallowing development resources.
 *
 * NON-DIAGNOSTIC: these are surveillance prompts, not a test or a label. The CDC
 * guidance is explicit that a child not yet showing a milestone is a cue to
 * "act early" and talk to a provider — never a diagnosis. `skillLooksLike` gives
 * the everyday, plain-language picture of the behavior.
 */

/* ───────────────────────────── Sources (B-LOOP-01) ───────────────────────────── */

/**
 * B-LOOP-01 [VETO-FIRST clinical] — every catalogue row names the public
 * document its age claim comes from, with the age semantics that document
 * uses. A row with no public source does not ship. The parent-facing age
 * sentence is built ONLY by `milestoneAgeLine` (lib/milestoneAgeLine.ts).
 * Every source family has a row in
 * PAI/projects/arbor/execution/2026-10-06--milestone-loop/REVIEW-SHEET.md for
 * the clinical reviewer (G-01).
 */

/** CDC 2022: the age by which MOST (about 75 %) children do the skill. */
export const CDC_2022_SOURCE: MilestoneSource = { org: "CDC", title: "Learn the Signs. Act Early. (2022 revision, Zubler et al.)", url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html", year: 2022, ageSemantics: "most_children_by" };

/** ASHA 2023 Communication Milestones. B-LOOP-01 (orchestrator ruling, 6 Oct):
 *  "never ship ASHA over a number ASHA did not print". The range ASHA prints
 *  for these six rows could not be cited in the build session (no network; the
 *  intelligibility percentages and the feeding items are not confirmed ASHA
 *  milestone-page items), so every ASHA row is "unstated": the source is named,
 *  no age line renders, and REVIEW-SHEET.md asks the reviewer to re-source. */
export const ashaUnstated = (note: string): MilestoneSource => ({ org: "ASHA", title: "Communication Milestones (2023)", url: "https://www.asha.org/public/developmental-milestones/", year: 2023, ageSemantics: "unstated", note });

const ASHA_FEEDING_NOTE = "Feeding item: ASHA's feeding page and the age range it prints could not be cited offline; no age line until the reviewer re-sources it.";
const ASHA_INTELLIGIBILITY_NOTE = "The intelligibility percentage is not a confirmed item of ASHA's milestone page (commonly attributed to Coplan & Gleason 1988); no ASHA range is cited over it.";

/** B-LOOP-03 — CDC rows whose skill is eating or drinking: tagged "feeding"
 *  so the parent finds them on the Food & growth shelf (lib/shelves). */
const CDC_FEEDING_IDS: ReadonlySet<string> = new Set(["cdc-15m-8", "cdc-18m-9", "cdc-60m-12"]);

/** Build a stable, deterministic id for a CDC checklist item. */
const cdc = (
  ageMonths: number,
  ageGroup: string,
  domain: Milestone["domain"],
  n: number,
  title: string,
  description: string,
  skillLooksLike: string
): Milestone => ({
  id: `cdc-${ageMonths}m-${n}`,
  domain,
  ageMonths,
  ageGroup,
  title,
  description,
  skillLooksLike,
  // Honest empty state: CDC items seed UNobserved and the parent marks what
  // they've actually seen. (We deliberately do NOT auto-check by a fixed age
  // literal — that read as artificial per-child "progress" rather than truth.)
  checked: false,
  source: CDC_2022_SOURCE,
  ...(CDC_FEEDING_IDS.has(`cdc-${ageMonths}m-${n}`) ? { tags: ["feeding" as const] } : {}),
});

export const CDC_MILESTONES: Milestone[] = [
  // ─────────────────────────────── 2 months ───────────────────────────────
  cdc(2, "2 months", "social_development", 1, "Calms when comforted", "Calms down when spoken to or picked up.", "When your baby fusses, hearing your voice or being lifted settles them."),
  cdc(2, "2 months", "social_development", 2, "Smiles at people", "Looks at your face; seems happy to see you when you walk up.", "A real social smile — not just a reflex — aimed right at you."),
  cdc(2, "2 months", "language_communication", 3, "Makes sounds other than crying", "Coos and makes gurgling 'ooh' and 'aah' sounds.", "Soft vowel sounds when content, especially when you talk back."),
  cdc(2, "2 months", "language_communication", 4, "Reacts to loud sounds", "Startles, blinks, or quiets to a sudden loud noise.", "A bang or loud voice gets a clear reaction — a flinch or a pause."),
  cdc(2, "2 months", "cognition_executive_function", 5, "Watches you move", "Watches you as you move around the room.", "Their eyes track you crossing the room or leaning in and out."),
  cdc(2, "2 months", "cognition_executive_function", 6, "Looks at a toy", "Looks at a toy you hold for several seconds.", "Holds their gaze on a rattle or your face for a few seconds."),
  cdc(2, "2 months", "sensory_motor_patterns", 7, "Holds head up in tummy time", "Holds head up when on their tummy.", "During tummy time, the head lifts and stays up briefly."),
  cdc(2, "2 months", "sensory_motor_patterns", 8, "Moves both arms and legs", "Moves both arms and both legs.", "Wriggling and kicking that uses both sides, not just one."),

  // ─────────────────────────────── 4 months ───────────────────────────────
  cdc(4, "4 months", "social_development", 1, "Smiles to get your attention", "Smiles on their own to get you to come over.", "A deliberate smile aimed at pulling you in, then watching for your reaction."),
  cdc(4, "4 months", "social_development", 2, "Chuckles", "Chuckles (not yet a full laugh) when you try to make them laugh.", "Short happy chuckles during peek-a-boo or tickles."),
  cdc(4, "4 months", "language_communication", 3, "Coos back and forth", "Makes sounds back when you talk to them — a 'conversation'.", "You say something, they coo, you answer — taking turns with sound."),
  cdc(4, "4 months", "language_communication", 4, "Turns head toward voices", "Turns head toward the sound of your voice.", "Hearing you across the room, they swivel to find you."),
  cdc(4, "4 months", "cognition_executive_function", 5, "Looks at their hands", "Looks at their own hands with interest.", "Studies their fingers like a fascinating new toy."),
  cdc(4, "4 months", "cognition_executive_function", 6, "Reaches for toys", "If hungry, opens mouth when sees breast or bottle; reaches toward a toy.", "Sees a dangling toy and swings an arm to bat or grab it."),
  cdc(4, "4 months", "sensory_motor_patterns", 7, "Holds head steady", "Holds head steady without support when you are holding them.", "Held upright, the head stays level instead of bobbing."),
  cdc(4, "4 months", "sensory_motor_patterns", 8, "Brings hands to mouth", "Brings hands to mouth; pushes up on elbows in tummy time.", "Hands find the mouth on purpose; props up on forearms when on the tummy."),

  // ─────────────────────────────── 6 months ───────────────────────────────
  cdc(6, "6 months", "social_development", 1, "Knows familiar people", "Recognises familiar people; is shy or nervous with strangers.", "Lights up for you and grandma, but studies an unfamiliar face warily."),
  cdc(6, "6 months", "social_development", 2, "Likes their mirror reflection", "Likes to look at themselves in a mirror.", "Leans in and reaches for the 'baby' in the mirror."),
  cdc(6, "6 months", "language_communication", 3, "Takes turns making sounds", "Takes turns making sounds with you.", "You make a sound, they answer with one — a back-and-forth of noises."),
  cdc(6, "6 months", "language_communication", 4, "Blows raspberries", "Blows 'raspberries' (sticks tongue out and blows).", "That sputtering lip-and-tongue noise, often repeated for fun."),
  cdc(6, "6 months", "cognition_executive_function", 5, "Puts things in mouth to explore", "Puts things in their mouth to explore them.", "Everything goes to the mouth — that's how they 'examine' it."),
  cdc(6, "6 months", "cognition_executive_function", 6, "Reaches to grab a toy", "Reaches to grab a toy they want.", "Spots a toy out of reach and stretches and leans to get it."),
  cdc(6, "6 months", "sensory_motor_patterns", 7, "Rolls over", "Rolls from tummy to back.", "Flips from tummy onto their back, sometimes surprising themselves."),
  cdc(6, "6 months", "sensory_motor_patterns", 8, "Leans on hands to sit", "Pushes up with straight arms; leans on hands to support themselves sitting.", "Props forward on both hands to stay propped in a sit."),

  // ─────────────────────────────── 9 months ───────────────────────────────
  cdc(9, "9 months", "attachment_regulation", 1, "Shows several facial expressions", "Shows several expressions — happy, sad, angry, surprised.", "Their face clearly reads as delighted, cross, or startled depending on the moment."),
  cdc(9, "9 months", "attachment_regulation", 2, "Reacts when you leave", "Looks for you, may cling or get upset when you step away (stranger/separation awareness).", "Notices you leaving the room and protests or searches for you."),
  cdc(9, "9 months", "social_development", 3, "Plays peek-a-boo", "Smiles or laughs during back-and-forth games like peek-a-boo.", "Anticipates the 'boo!' and giggles before it even comes."),
  cdc(9, "9 months", "language_communication", 4, "Babbles strings of sounds", "Makes different sounds like 'mamama' and 'bababa'.", "Long repeated babble chains that start to sound like talking."),
  cdc(9, "9 months", "language_communication", 5, "Lifts arms to be picked up", "Lifts arms up to be picked up.", "Reaches both arms toward you as a clear 'up, please'."),
  cdc(9, "9 months", "cognition_executive_function", 6, "Looks for hidden objects", "Looks for objects when dropped out of sight (like a spoon or toy).", "Watches where a dropped toy went and leans to find it."),
  cdc(9, "9 months", "cognition_executive_function", 7, "Bangs two things together", "Bangs two things together.", "Knocks two blocks or cups together, pleased with the noise."),
  cdc(9, "9 months", "sensory_motor_patterns", 8, "Sits without support", "Gets to a sitting position and sits without support.", "Stays upright in a sit with hands free to play."),
  cdc(9, "9 months", "sensory_motor_patterns", 9, "Moves things hand to hand", "Moves things from one hand to the other; uses fingers to rake food.", "Passes a toy between hands and rakes small bits toward themselves."),

  // ─────────────────────────────── 12 months ──────────────────────────────
  cdc(12, "12 months", "social_development", 1, "Plays games like pat-a-cake", "Plays games back-and-forth with you, like pat-a-cake.", "Joins in the actions of a familiar game and waits for their turn."),
  cdc(12, "12 months", "language_communication", 2, "Waves bye-bye", "Waves 'bye-bye'.", "Waves when someone leaves, often copying you."),
  cdc(12, "12 months", "language_communication", 3, "Says a parent name", "Calls a parent 'mama' or 'dada' or another special name.", "Uses 'mama'/'dada' for the right person, not just babble."),
  cdc(12, "12 months", "language_communication", 4, "Understands 'no'", "Understands 'no' — pauses briefly or stops when you say it.", "Reaching for the outlet, they pause when you say 'no'."),
  cdc(12, "12 months", "cognition_executive_function", 5, "Puts things in a container", "Puts something in a container, like a block in a cup.", "Drops a block into a cup, then often dumps it to do it again."),
  cdc(12, "12 months", "cognition_executive_function", 6, "Looks for hidden things", "Looks for things they see you hide, like a toy under a blanket.", "Watches you cover a toy and pulls the cover off to find it."),
  cdc(12, "12 months", "sensory_motor_patterns", 7, "Pulls up to stand", "Pulls up to stand holding furniture.", "Grabs the couch and hauls themselves to standing."),
  cdc(12, "12 months", "sensory_motor_patterns", 8, "Cruises along furniture", "Walks holding on to furniture ('cruising'); drinks from a cup you hold.", "Steps sideways gripping the couch; sips from a held cup."),
  cdc(12, "12 months", "sensory_motor_patterns", 9, "Picks up small things with finger and thumb", "Picks up small bits between thumb and finger (pincer grasp).", "Neatly pinches a small piece of food rather than raking it."),

  // ─────────────────────────────── 15 months ──────────────────────────────
  cdc(15, "15 months", "social_development", 1, "Copies other children", "Copies other children while playing, like taking toys out of a container.", "Watches another child empty a bin and starts doing the same."),
  cdc(15, "15 months", "social_development", 2, "Shows you objects", "Shows you an object they like; claps when excited; hugs a stuffed toy.", "Brings a toy over just to share it with you, not to ask for help."),
  cdc(15, "15 months", "language_communication", 3, "Says one or two words", "Tries to say one or two words besides 'mama'/'dada', like 'ba' for ball.", "Has a couple of real word-attempts they use consistently."),
  cdc(15, "15 months", "language_communication", 4, "Looks at a named object", "Looks at a familiar object when you name it; follows directions with a gesture.", "You say 'where's the ball?' and they look toward it."),
  cdc(15, "15 months", "cognition_executive_function", 5, "Uses objects correctly", "Tries to use things the right way — a phone, cup, or book.", "Holds a toy phone to their ear or 'reads' a book."),
  cdc(15, "15 months", "cognition_executive_function", 6, "Stacks two objects", "Stacks at least two small objects, like blocks.", "Balances one block on another, even if it tumbles."),
  cdc(15, "15 months", "sensory_motor_patterns", 7, "Takes a few steps alone", "Takes a few steps on their own.", "Lets go of the furniture and toddles a few wobbly steps."),
  cdc(15, "15 months", "independence_adaptive_skills", 8, "Uses fingers to feed themselves", "Uses fingers to feed themselves some food.", "Picks up bits of finger food and gets most of it to the mouth."),

  // ─────────────────────────────── 18 months ──────────────────────────────
  cdc(18, "18 months", "social_development", 1, "Moves away but checks for you", "Moves away from you but looks to make sure you are close.", "Toddles off to explore, then glances back to find you."),
  cdc(18, "18 months", "social_development", 2, "Points to show you things", "Points to show you something interesting.", "Spots a dog and points so you'll look too — sharing, not asking."),
  cdc(18, "18 months", "social_development", 3, "Helps with dressing", "Puts hands out for washing; helps by pushing an arm through a sleeve.", "Holds out an arm or foot to cooperate when getting dressed."),
  cdc(18, "18 months", "language_communication", 4, "Says three or more words", "Tries to say three or more words besides 'mama'/'dada'.", "Has a small handful of words they use on purpose."),
  cdc(18, "18 months", "language_communication", 5, "Follows one-step directions", "Follows one-step directions without a gesture, like 'give it to me'.", "Hands you a toy when asked, without you pointing."),
  cdc(18, "18 months", "cognition_executive_function", 6, "Copies chores", "Copies you doing chores, like sweeping with a broom.", "Grabs a cloth and 'wipes' the table because you did."),
  cdc(18, "18 months", "cognition_executive_function", 7, "Plays with toys simply", "Plays with toys in a simple way, like pushing a toy car.", "Rolls a car along the floor making 'vroom' rather than just mouthing it."),
  cdc(18, "18 months", "sensory_motor_patterns", 8, "Walks without holding on", "Walks without holding on to anyone or anything.", "Crosses the room steadily on their own two feet."),
  cdc(18, "18 months", "independence_adaptive_skills", 9, "Drinks and eats by themselves", "Scribbles; drinks from a cup without a lid and may spill; feeds with fingers.", "Manages an open cup with some mess and scribbles with a crayon."),

  // ─────────────────────────────── 24 months (2 years) ────────────────────
  cdc(24, "2 years", "social_development", 1, "Notices others' feelings", "Notices when others are hurt or upset, like pausing or looking sad when someone cries.", "Stops and looks concerned when another child is crying."),
  cdc(24, "2 years", "social_development", 2, "Looks at your reaction", "Looks at your face to see how to react in a new situation.", "Faced with something new, they check your expression before deciding."),
  cdc(24, "2 years", "language_communication", 3, "Says two words together", "Says at least two words together, like 'more milk'.", "Combines two words into a tiny phrase to make a point."),
  cdc(24, "2 years", "language_communication", 4, "Points to things in a book", "Points to things in a book when you ask, like 'where is the bear?'.", "You ask for the bear and they put a finger on it."),
  // B-LOOP-01 (reconcile, 6 Oct): this row WAS titled "Names objects in a book" (CDC's 30-month item, = cdc-30m-5)
  // over a description fusing two CDC 24-month items. It is now ONE skill — body parts — and the gestures item is
  // its own row (cdc-24m-11). "Points to things in a book" is cdc-24m-4.
  cdc(24, "2 years", "language_communication", 5, "Points to body parts", "Points to at least two body parts when you ask, like 'where is your nose?'.", "Can point out a nose or tummy when you name it."),
  cdc(24, "2 years", "language_communication", 11, "Uses more gestures", "Uses more gestures than just waving and pointing, like blowing a kiss or nodding yes.", "Blows a kiss goodbye or nods to say yes."),
  cdc(24, "2 years", "cognition_executive_function", 6, "Holds something while using the other hand", "Holds something in one hand while using the other, like a toy while opening a lid.", "Steadies a container in one hand and twists the lid with the other."),
  cdc(24, "2 years", "cognition_executive_function", 7, "Tries switches and buttons", "Tries to use switches, knobs, or buttons on a toy.", "Pokes, twists, and flips every button to see what happens."),
  cdc(24, "2 years", "cognition_executive_function", 8, "Plays with more than one toy together", "Plays with more than one toy at once, like putting toy food on a toy plate.", "Combines toys into a little scene rather than one at a time."),
  cdc(24, "2 years", "sensory_motor_patterns", 9, "Kicks a ball", "Kicks a ball.", "Swings a foot and connects with the ball, even off-balance."),
  cdc(24, "2 years", "sensory_motor_patterns", 10, "Runs and climbs", "Runs; walks up a few stairs with or without help.", "Picks up speed into a run and climbs the bottom stairs."),

  // ─────────────────────────────── 30 months ──────────────────────────────
  cdc(30, "30 months", "social_development", 1, "Plays next to other children", "Plays next to other children and sometimes plays with them.", "Side-by-side play that occasionally turns into doing the same game together."),
  cdc(30, "30 months", "social_development", 2, "Shows you what they can do", "Shows you what they can do by saying 'look at me!'.", "Calls for your eyes before doing a 'trick' like a jump."),
  cdc(30, "30 months", "language_communication", 3, "Says about 50 words", "Says about 50 words.", "A real vocabulary you'd struggle to list — well past a handful."),
  cdc(30, "30 months", "language_communication", 4, "Uses action words", "Says two or more words together with one action word, like 'doggie run'.", "Phrases now include doing-words, not just naming-words."),
  cdc(30, "30 months", "language_communication", 5, "Names things in a book", "Names things in a book when you point and ask 'what is this?'.", "Supplies the word when you point to a picture."),
  cdc(30, "30 months", "cognition_executive_function", 6, "Uses things to pretend", "Uses things to pretend, like feeding a block to a doll as if it is food.", "Pretend play where one object stands in for another."),
  cdc(30, "30 months", "cognition_executive_function", 7, "Solves simple problems", "Shows simple problem-solving skills, like standing on a stool to reach.", "Drags over a stool to get to something out of reach."),
  cdc(30, "30 months", "cognition_executive_function", 8, "Follows two-step directions", "Follows two-step instructions, like 'put the toy down and close the door'.", "Carries out a two-part request in order."),
  cdc(30, "30 months", "cognition_executive_function", 9, "Knows at least one colour", "Knows at least one colour, like pointing to a red crayon when asked.", "Picks the red one out of the box when you ask for red."),
  cdc(30, "30 months", "sensory_motor_patterns", 10, "Jumps off the ground", "Jumps off the ground with both feet.", "Both feet leave the floor together in a little hop."),
  cdc(30, "30 months", "independence_adaptive_skills", 11, "Turns knobs and pages", "Turns book pages one at a time; takes some clothes off; twists doorknobs.", "Manages page-turns, peels off a sock, and opens a door."),

  // ─────────────────────────────── 3 years (36 months) ────────────────────
  cdc(36, "3 years", "attachment_regulation", 1, "Calms after you leave", "Calms down within about 10 minutes after you leave, like at daycare drop-off.", "Drop-off tears settle into play within ten minutes or so."),
  cdc(36, "3 years", "social_development", 2, "Joins other children", "Notices other children and joins them to play.", "Walks up to a group at the park and gets involved."),
  cdc(36, "3 years", "language_communication", 3, "Talks well enough to be understood", "Talks well enough that others can understand most of the time.", "A stranger could follow most of what they say."),
  cdc(36, "3 years", "language_communication", 4, "Asks 'who/what/where/why'", "Asks 'who', 'what', 'where', or 'why' questions, like 'where is mommy?'.", "A steady stream of wh-questions about everything."),
  cdc(36, "3 years", "language_communication", 5, "Says first name", "Says their first name when asked.", "Answers 'what's your name?' with their own name."),
  cdc(36, "3 years", "language_communication", 6, "Talks in conversation", "Has a back-and-forth conversation using two or three sentences.", "Can keep a short chat going with a couple of replies."),
  cdc(36, "3 years", "cognition_executive_function", 7, "Draws a circle", "Draws a circle when you show them how.", "Copies a round shape after watching you draw one."),
  cdc(36, "3 years", "cognition_executive_function", 8, "Avoids hot things when warned", "Avoids touching hot objects, like a stove, when you warn them.", "Heeds 'hot!' and keeps their hands back."),
  cdc(36, "3 years", "sensory_motor_patterns", 9, "Strings beads / uses utensils", "Strings items together, like large beads; puts on some clothes; uses a fork.", "Threads big beads and eats with a fork without much help."),

  // ─────────────────────────────── 4 years (48 months) ────────────────────
  cdc(48, "4 years", "social_development", 1, "Pretends to be something else", "Pretends to be something else during play, like a teacher or superhero.", "Takes on a role and stays in character through the game."),
  cdc(48, "4 years", "social_development", 2, "Asks to play with others", "Asks to go play with children if none are around.", "Seeks out playmates rather than waiting to be invited."),
  cdc(48, "4 years", "social_development", 3, "Comforts others", "Comforts others who are hurt or sad, like hugging a crying friend.", "Notices distress and offers a hug or kind words."),
  cdc(48, "4 years", "social_development", 4, "Avoids danger", "Avoids danger, like not jumping from tall heights at the playground.", "Shows some caution rather than leaping off everything."),
  cdc(48, "4 years", "social_development", 5, "Likes to be a 'helper'", "Likes to be a helper; changes behaviour based on where they are.", "Volunteers to help and behaves differently at the library vs the park."),
  cdc(48, "4 years", "language_communication", 6, "Says sentences of four+ words", "Says sentences with four or more words.", "Full, multi-word sentences carry whole ideas."),
  cdc(48, "4 years", "language_communication", 7, "Says some words from a song", "Says some words from a song, story, or nursery rhyme from memory.", "Fills in or recites bits of a familiar rhyme."),
  cdc(48, "4 years", "language_communication", 8, "Talks about their day", "Talks about at least one thing that happened during their day.", "Recounts a moment from earlier — 'we painted at school'."),
  cdc(48, "4 years", "language_communication", 9, "Answers simple questions", "Answers simple questions like 'what is a coat for?'.", "Explains the everyday purpose of familiar things."),
  cdc(48, "4 years", "cognition_executive_function", 10, "Names a few colours", "Names a few colours of items.", "Correctly labels several colours, not just one."),
  cdc(48, "4 years", "cognition_executive_function", 11, "Understands time words", "Tells what comes next in a familiar story; understands 'morning', 'night'.", "Predicts the next part of a known story and uses time-of-day words."),
  cdc(48, "4 years", "cognition_executive_function", 12, "Draws a person with body parts", "Draws a person with three or more body parts.", "A stick-person that has a head plus arms or legs."),
  cdc(48, "4 years", "sensory_motor_patterns", 13, "Catches a large ball", "Catches a large ball most of the time; serves food onto a plate.", "Traps a tossed ball against their body and can dish out food."),
  cdc(48, "4 years", "independence_adaptive_skills", 14, "Unbuttons some buttons", "Unbuttons some buttons.", "Works simple buttons open when undressing."),

  // ─────────────────────────────── 5 years (60 months) ────────────────────
  cdc(60, "5 years", "attachment_regulation", 1, "Follows rules and takes turns", "Follows rules or takes turns when playing games with other children.", "Waits their turn in a board game and accepts the rules."),
  cdc(60, "5 years", "social_development", 2, "Does simple chores", "Does simple chores at home, like matching socks or clearing the table.", "Carries out a small responsibility when asked."),
  cdc(60, "5 years", "social_development", 3, "Sings, dances, or acts", "Sings, dances, or acts for you.", "Performs a song or routine, enjoying the audience."),
  cdc(60, "5 years", "language_communication", 4, "Tells a simple story", "Tells a story they heard or made up with at least two events.", "Strings together a short story with more than one thing happening."),
  cdc(60, "5 years", "language_communication", 5, "Answers questions about a story", "Answers simple questions about a book or story after you read or tell it.", "Recalls and answers 'what happened next?' about a story."),
  cdc(60, "5 years", "language_communication", 6, "Keeps a conversation going", "Keeps a conversation going with more than three back-and-forth exchanges.", "Holds a real to-and-fro chat, not just one reply."),
  cdc(60, "5 years", "language_communication", 7, "Uses or recognises rhymes", "Uses or recognises simple rhymes, like 'bat–cat' or 'ball–tall'.", "Spots or supplies rhyming words for fun."),
  cdc(60, "5 years", "cognition_executive_function", 8, "Counts to 10", "Counts to 10.", "Recites the numbers one through ten in order."),
  cdc(60, "5 years", "cognition_executive_function", 9, "Names some numbers", "Names some numbers between 1 and 5 when you point to them.", "Identifies a written numeral when you point to it."),
  cdc(60, "5 years", "cognition_executive_function", 10, "Pays attention for 5–10 minutes", "Pays attention for 5 to 10 minutes during an activity (not screen time).", "Stays focused on a puzzle or craft for several minutes."),
  cdc(60, "5 years", "cognition_executive_function", 11, "Writes some letters of their name", "Writes some letters in their name; names some letters when you point.", "Forms a few recognisable letters from their own name."),
  cdc(60, "5 years", "sensory_motor_patterns", 12, "Uses a fork and spoon well", "Uses a fork and spoon well; may be able to use a butter knife.", "Eats a full meal neatly with utensils."),
  cdc(60, "5 years", "sensory_motor_patterns", 13, "Hops on one foot", "Hops on one foot.", "Balances and hops on a single foot a few times."),
  cdc(60, "5 years", "independence_adaptive_skills", 14, "Buttons some buttons", "Buttons some buttons.", "Fastens simple buttons when dressing."),
];

/**
 * ASHA-2023 communication & feeding milestones that complement the CDC set —
 * articulation intelligibility benchmarks and oral-feeding development that the
 * CDC checklists touch only lightly. Sourced from ASHA's "Communication
 * Milestones" and feeding/swallowing development guidance.
 * B-LOOP-01: each row carries `source: ashaUnstated(note)` — ASHA named, no
 * age line rendered — until the clinical reviewer (G-01) cites the range ASHA
 * prints for the item (REVIEW-SHEET.md rows 7–12).
 */
export const ASHA_MILESTONES: Milestone[] = [
  {
    id: "asha-feed-9m",
    source: ashaUnstated(ASHA_FEEDING_NOTE),
    tags: ["feeding"],
    domain: "independence_adaptive_skills",
    ageMonths: 9,
    ageGroup: "9 months",
    title: "Eats mashed and soft table foods",
    description: "ASHA feeding: moves from purées to thicker mashed and soft, dissolvable table foods; begins munching.",
    skillLooksLike: "Manages lumpier textures and gums soft pieces instead of only smooth purée.",
    checked: false,
  },
  {
    id: "asha-feed-12m",
    source: ashaUnstated(ASHA_FEEDING_NOTE),
    tags: ["feeding"],
    domain: "independence_adaptive_skills",
    ageMonths: 12,
    ageGroup: "12 months",
    title: "Finger-feeds and sips from a cup",
    description: "ASHA feeding: feeds self soft finger foods; takes sips from an open or straw cup with help.",
    skillLooksLike: "Picks up small soft pieces to self-feed and drinks from a cup, weaning off the bottle.",
    checked: false,
  },
  {
    id: "asha-comm-24m",
    source: ashaUnstated(ASHA_INTELLIGIBILITY_NOTE),
    domain: "language_communication",
    ageMonths: 24,
    ageGroup: "2 years",
    title: "About half of speech is understandable",
    description: "ASHA articulation: a 2-year-old is understood by familiar listeners roughly 50% of the time.",
    skillLooksLike: "You catch about half of what they say; strangers catch less, and that's expected.",
    checked: false,
  },
  {
    id: "asha-feed-24m",
    source: ashaUnstated(ASHA_FEEDING_NOTE),
    tags: ["feeding"],
    domain: "independence_adaptive_skills",
    ageMonths: 24,
    ageGroup: "2 years",
    title: "Eats a wide range of textures",
    description: "ASHA feeding: chews a variety of foods and textures; drinks from an open cup with less spilling.",
    skillLooksLike: "Handles most family foods, chewing rather than just mashing, with fewer spills."  ,
    checked: false,
  },
  {
    id: "asha-comm-36m",
    source: ashaUnstated(ASHA_INTELLIGIBILITY_NOTE),
    domain: "language_communication",
    ageMonths: 36,
    ageGroup: "3 years",
    title: "Speech is about 75% understandable",
    description: "ASHA articulation: a 3-year-old is understood by most listeners about 75% of the time.",
    skillLooksLike: "Most people, even those who don't know them, follow three-quarters of their speech.",
    checked: false,
  },
  {
    id: "asha-comm-48m",
    source: ashaUnstated("ASHA's 4 to 5 years bracket lists speech sounds that may still be developing, but this item's wording and bracket could not be confirmed offline; no age line until the reviewer re-sources it."),
    domain: "language_communication",
    ageMonths: 48,
    ageGroup: "4 years",
    title: "Speech is almost fully understandable",
    description: "ASHA articulation: by 4, speech is understood nearly all the time, though some sounds are still developing.",
    skillLooksLike: "Strangers understand almost everything; a few late sounds (r, l, s, th) may still wobble.",
    checked: false,
  },
];

/**
 * B-LOOP-01 — Arbor's own 4–6y rows (m-1…m-10) are RETIRED. Each was checked
 * one by one against the CDC 4-year and 5-year checklists, AAP and NHS parent
 * pages; none could be tied to a public document stating THAT skill at THAT
 * age with confidence (two duplicated a CDC row at a different age; the
 * per-row verdicts are in REVIEW-SHEET.md). The export stays, empty, so its
 * callers and the capability floor keep their seam; a 4–6y row comes back
 * only with its `source`.
 */
export const ARBOR_EXTENDED_MILESTONES: Milestone[] = [];

/** B-LOOP-01 — the retired Arbor ids. Stored child records may still carry
 *  them; they are no longer catalogue rows (no Hebrew text, no age line). */
export const RETIRED_MILESTONE_IDS: readonly string[] = ["m-1", "m-2", "m-3", "m-4", "m-5", "m-6", "m-7", "m-8", "m-9", "m-10"];

/** The full, ordered milestone library Arbor seeds into a new child record. */
export const ALL_MILESTONES: Milestone[] = [
  ...CDC_MILESTONES,
  ...ASHA_MILESTONES,
  ...ARBOR_EXTENDED_MILESTONES,
];

/* ───────────────────────────── Corrected age (preterm) ───────────────────────────── */

export interface CorrectedAge {
  /** Chronological age in months (since birth). */
  chronologicalMonths: number;
  /** Age in months adjusted for prematurity (never below 0). */
  correctedMonths: number;
  /** Weeks subtracted to correct (0 for a term baby). */
  adjustmentWeeks: number;
  /** Whether the correction is still applied (AAP: stop correcting at ~24 months). */
  applied: boolean;
}

/** Term gestation in weeks. */
const TERM_WEEKS = 40;
/** AAP guidance: stop correcting for prematurity at about 2 years (24 months). */
const CORRECTION_CEILING_MONTHS = 24;

/**
 * Compute corrected (adjusted) age for a preterm child. The correction is
 * `(40 − gestationalWeeks)` weeks, converted to months, subtracted from the
 * chronological age — and only while the child is under ~24 months corrected
 * (AAP). For a term baby (≥40w) or an older child, corrected age equals
 * chronological age.
 */
export function correctedAge(chronologicalMonths: number, gestationalWeeks?: number): CorrectedAge {
  const safeChrono = Math.max(0, chronologicalMonths);
  if (gestationalWeeks == null || gestationalWeeks >= TERM_WEEKS) {
    return { chronologicalMonths: safeChrono, correctedMonths: safeChrono, adjustmentWeeks: 0, applied: false };
  }
  const adjustmentWeeks = TERM_WEEKS - gestationalWeeks;
  const applied = safeChrono < CORRECTION_CEILING_MONTHS;
  const correctedMonths = applied
    ? Math.max(0, safeChrono - adjustmentWeeks * (12 / 52))
    : safeChrono;
  return {
    chronologicalMonths: safeChrono,
    correctedMonths: Math.round(correctedMonths * 10) / 10,
    adjustmentWeeks,
    applied,
  };
}

/**
 * The age (in months) a milestone checklist should be compared against for this
 * child — corrected for prematurity where it applies. Used to decide which
 * checklist is "current" so preterm infants aren't flagged early.
 */
export function comparisonAgeMonths(chronologicalMonths: number, gestationalWeeks?: number): number {
  return correctedAge(chronologicalMonths, gestationalWeeks).correctedMonths;
}

/* ───────────────────────────── Age-band grouping ───────────────────────────── */

/**
 * The canonical milestone age bands, in ascending order. A band collects every
 * milestone whose `ageMonths` is `>= months` and below the next band's `months`.
 * Used by the Milestones tab to group the ~175-item library into progressive,
 * collapsible sections instead of one flat list per domain.
 */
export const MILESTONE_AGE_BANDS: { months: number; label: string }[] = [
  { months: 2, label: "2 months" },
  { months: 4, label: "4 months" },
  { months: 6, label: "6 months" },
  { months: 9, label: "9 months" },
  { months: 12, label: "12 months" },
  { months: 15, label: "15 months" },
  { months: 18, label: "18 months" },
  { months: 24, label: "2 years" },
  { months: 30, label: "30 months" },
  { months: 36, label: "3 years" },
  { months: 48, label: "4 years" },
  { months: 60, label: "5 years" },
  { months: 72, label: "6 years +" },
];

/**
 * The band a given age-in-months falls into (the highest band whose threshold it
 * meets). Milestones with no `ageMonths` (legacy/custom) are bucketed by the
 * caller; this helper only handles numeric ages.
 */
/** B-GROWTH-27: a milestone band (keyed by its threshold months) → the
 *  canonical CDC-checkpoint bands it spans (lib/domains/ageBands.ts). */
export function milestoneBandToCanonical(bandMonths: number): CanonicalBandId[] {
  return toAgeBand("milestone", String(bandMonths));
}

export function bandForAgeMonths(ageMonths: number): { months: number; label: string } {
  let band = MILESTONE_AGE_BANDS[0];
  for (const b of MILESTONE_AGE_BANDS) {
    if (ageMonths >= b.months) band = b;
    else break;
  }
  return band;
}

/* ───────────────────────────── Age window (GP-08 / RUN-02 / lane C) ───────────────────────────── */

/** Ascending band thresholds, derived once from the canonical bands. */
const MILESTONE_BAND_MONTHS: readonly number[] = MILESTONE_AGE_BANDS.map((b) => b.months);

export interface MilestoneAgeWindow {
  /** The child's current (corrected) band threshold in months. */
  currentBandMonths: number;
  /** The one band immediately before it (equals currentBandMonths at the first band). */
  earlierBandMonths: number;
  /** Label of the current band (e.g. "9 months", "4 years"). */
  label: string;
  /** Whether a milestone anchored at `ageMonths` sits inside the window.
   *  Unanchored items (legacy/custom, no `ageMonths`) always count. */
  includes: (milestoneAgeMonths: number | undefined) => boolean;
}

/**
 * THE shared age window: the child's current CDC band plus the one before it.
 * Every parent-facing denominator ("x of y noticed"), every "next" pick and the
 * consult packet window against this — never the whole 0–6y catalogue, so a
 * 6-month-old's parent is not shown "0 of 133" and a 5-year-old's parent is not
 * told to watch for "Smiles at people". `comparisonMonths` is the corrected
 * (preterm-adjusted) age — see comparisonAgeMonths().
 */
export function milestoneAgeWindow(comparisonMonths: number): MilestoneAgeWindow {
  const current = bandForAgeMonths(Math.max(0, Number.isFinite(comparisonMonths) ? comparisonMonths : 0));
  const idx = MILESTONE_BAND_MONTHS.indexOf(current.months);
  const earlierBandMonths = idx > 0 ? MILESTONE_BAND_MONTHS[idx - 1] : current.months;
  const includes = (milestoneAgeMonths: number | undefined): boolean => {
    if (typeof milestoneAgeMonths !== "number" || !Number.isFinite(milestoneAgeMonths)) return true;
    const itemBand = bandForAgeMonths(milestoneAgeMonths).months;
    return itemBand >= earlierBandMonths && itemBand <= current.months;
  };
  return { currentBandMonths: current.months, earlierBandMonths, label: current.label, includes };
}

/** The milestones inside the child's age window (current band + one earlier). */
export function ageWindowMilestones<M extends { ageMonths?: number }>(milestones: M[], comparisonMonths: number): M[] {
  const window = milestoneAgeWindow(comparisonMonths);
  return milestones.filter((m) => window.includes(m.ageMonths));
}

/**
 * The ONE "worth watching next" derivation (RUN-02): open items in the child's
 * age window, ordered current band first ("not sure" ahead of untouched), then
 * the earlier band. Never an ahead-of-band item, never an unrelated infant item
 * for a kindergartener. `selectWeeklyFocus` is this list's head.
 */
export function selectNextMilestones(milestones: Milestone[], comparisonMonths: number, limit = 3): Milestone[] {
  const window = milestoneAgeWindow(comparisonMonths);
  const bandOf = (m: Milestone): number | null =>
    typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : null;
  const open = milestones.filter((m) => !m.checked && window.includes(m.ageMonths) && bandOf(m) !== null);
  const rank = (m: Milestone): number => {
    const inCurrent = bandOf(m) === window.currentBandMonths;
    const notSure = m.observationStatus === "not_sure";
    // current+not_sure < current < earlier+not_sure < earlier — stable within a tier.
    return (inCurrent ? 0 : 2) + (notSure ? 0 : 1);
  };
  return open
    .map((m, i) => ({ m, i, r: rank(m) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((x) => x.m);
}

/* ───────────────────────────── Weekly focus selection (UND-6) ───────────────────────────── */

/** How the weekly focus should be framed: "watch" = the parent marked it
 *  "not sure" (watch for it during everyday play), "try" = not yet / unmarked
 *  (try it together). Observational framing only — never a verdict. */
export type WeeklyFocusMode = "watch" | "try";

export interface WeeklyFocusSelection {
  milestone: Milestone;
  mode: WeeklyFocusMode;
}

/**
 * Pick the single milestone worth focusing on this week, age-aware (UND-6).
 *
 * Priority:
 *  1. "not sure" items in the child's CURRENT (corrected) band — the uncertainty
 *     signal is the natural "watch for this during play" focus.
 *  2. not-yet / unmarked items in the current band.
 *  3. The NEAREST EARLIER band with an open item ("not sure" preferred there too).
 *  4. null — the caller shows its existing empty state.
 *
 * Never selects an ahead-of-band item, and never an item from a far-earlier
 * band while current-band items exist. `comparisonMonths` is the corrected
 * (preterm-adjusted) age in months — see comparisonAgeMonths().
 */
export function selectWeeklyFocus(milestones: Milestone[], comparisonMonths: number): WeeklyFocusSelection | null {
  // Single derivation (RUN-02): the weekly focus is the head of the shared
  // "next" list — current band first (not-sure ahead), then the earlier band.
  const [first] = selectNextMilestones(milestones, comparisonMonths, 1);
  if (first) return { milestone: first, mode: first.observationStatus === "not_sure" ? "watch" : "try" };

  // Beyond the window: the NEAREST earlier band with an open item (a parent who
  // never marked the 9-month list for a 3-year-old still gets a real focus).
  const currentBandMonths = bandForAgeMonths(comparisonMonths).months;
  const bandOf = (m: Milestone): number | null =>
    typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : null;
  const earlier = milestones.filter((m) => {
    const b = bandOf(m);
    return !m.checked && b !== null && b < currentBandMonths;
  });
  if (earlier.length > 0) {
    const nearestBandMonths = Math.max(...earlier.map((m) => bandOf(m) as number));
    const nearest = earlier.filter((m) => bandOf(m) === nearestBandMonths);
    const notSure = nearest.find((m) => m.observationStatus === "not_sure");
    if (notSure) return { milestone: notSure, mode: "watch" };
    return { milestone: nearest[0], mode: "try" };
  }
  return null;
}

/* ───────────────────────────── Explain prompt (UND-8) ───────────────────────────── */

/**
 * The AI "explain this milestone" prompt, months-precise for under-24-month
 * children (a "9-month-old", never a "0-year-old"). Pure and exported so the
 * infant phrasing is snapshot-tested.
 */
export function explainMilestonePrompt(title: string, chronoMonths: number): string {
  const safeMonths = Math.max(0, Math.round(Number.isFinite(chronoMonths) ? chronoMonths : 0));
  const ageDescriptor = safeMonths < 24
    ? `${safeMonths}-month-old`
    : `${Math.floor(safeMonths / 12)}-year-old`;
  return `Briefly explain the developmental milestone "${title}" for a ${ageDescriptor}. Cover: typical age range, what it looks like in everyday life, and 2 concrete ways a parent can support it. Non-diagnostic, warm, short. Use the headings ### Typical age, ### What it looks like, ### How to support.`;
}

/* ───────────────────────────── Catalogue text by stable id (B-GROWTH-11) ───────────────────────────── */

/**
 * Review state of the Hebrew catalogue text (i18nElevation/milestoneCatalogue.ts).
 * "ai-first-pass" = an AI first pass shipped under Guy's G8; native review is
 * pending (GD-6). The Science page prints one line from it (key
 * `ms.heReview.note`); flip to "native-reviewed" only when GD-6 signs off.
 */
export const MILESTONE_HE_REVIEW: "ai-first-pass" | "native-reviewed" = "ai-first-pass";

/** The three catalogue text fields, as keyed in the dictionaries. */
export type MilestoneTextField = "title" | "desc" | "looks";

/** The description the app writes onto a parent-added milestone
 *  (context/ArborContext addCustomMilestone) — app copy, not parent text. */
export const CUSTOM_MILESTONE_DESC = "Custom milestone added by parent.";
/** The ageGroup the app writes onto a parent-added milestone. */
export const CUSTOM_MILESTONE_AGE_GROUP = "Custom";

const CATALOGUE_IDS: ReadonlySet<string> = new Set(ALL_MILESTONES.map((m) => m.id));

/** True for a seeded catalogue row (CDC / ASHA / Arbor id), never for a
 *  parent-added one — those keep the parent's own words. */
export const isCatalogueMilestone = (m: { id: string; custom?: boolean }): boolean =>
  !m.custom && CATALOGUE_IDS.has(m.id);

export const milestoneTextKey = (id: string, field: MilestoneTextField): string => `ms.item.${id}.${field}`;
export const milestoneBandKey = (months: number): string => `ms.band.${months}`;

/** Catalogue ageGroup strings → their dictionary key. A label that equals a
 *  band label reuses the band key; the Arbor "Age 4-5" style labels get their
 *  own `ms.ageGroup.<slug>` key. */
export const MILESTONE_AGE_GROUP_KEYS: ReadonlyMap<string, string> = (() => {
  const byLabel = new Map<string, string>();
  for (const b of MILESTONE_AGE_BANDS) byLabel.set(b.label, milestoneBandKey(b.months));
  for (const m of ALL_MILESTONES) {
    if (byLabel.has(m.ageGroup)) continue;
    const slug = m.ageGroup.toLowerCase().replace(/^age\s*/, "").trim().replace(/\s+/g, "-");
    byLabel.set(m.ageGroup, `ms.ageGroup.${slug}`);
  }
  return byLabel;
})();

/** Structural `t()` — keeps this module free of the i18n import. */
type MilestoneT = (key: string, vars?: Record<string, string | number>) => string;

const resolved = (t: MilestoneT, key: string): string | null => {
  const v = t(key);
  return v && v !== key ? v : null;
};

/**
 * THE render seam for milestone text. A catalogue row resolves by its stable
 * id in the page language (the stored doc carries the English seed text, copied
 * at seed time, so the lookup must be by id at render). A parent-added row
 * returns the parent's own words — except the app's own placeholder
 * description, which is UI copy and is translated.
 */
export function milestoneText(
  m: { id: string; title: string; description?: string; skillLooksLike?: string; custom?: boolean },
  field: MilestoneTextField,
  t: MilestoneT,
  /** W2-GROWTH r2 (Law 8): pass the child's profile gender and the catalogue's
   *  Hebrew slash forms resolve to ONE form (lib/hebrewSlashGender). */
  opts?: { gender?: string | null },
): string {
  const stored = field === "title" ? m.title : field === "desc" ? m.description ?? "" : m.skillLooksLike ?? "";
  if (isCatalogueMilestone(m)) {
    const text = resolved(t, milestoneTextKey(m.id, field)) ?? stored;
    return opts ? resolveHebrewSlash(text, opts.gender) : text;
  }
  if (field === "desc" && m.description === CUSTOM_MILESTONE_DESC) return resolved(t, "ms.customDesc") ?? stored;
  return stored;
}

/** A milestone's age label in the page language (`ageGroup` is stored English). */
export function milestoneAgeGroupText(m: { ageGroup?: string; custom?: boolean }, t: MilestoneT): string {
  const ageGroup = m.ageGroup ?? "";
  if (!ageGroup) return "";
  if (ageGroup === CUSTOM_MILESTONE_AGE_GROUP) return resolved(t, "ms.custom") ?? ageGroup;
  const key = MILESTONE_AGE_GROUP_KEYS.get(ageGroup);
  return (key && resolved(t, key)) || ageGroup;
}

/** A milestone band's label in the page language. */
export function milestoneBandLabel(months: number, t: MilestoneT): string {
  const fallback = MILESTONE_AGE_BANDS.find((b) => b.months === months)?.label ?? "";
  return resolved(t, milestoneBandKey(months)) ?? fallback;
}
