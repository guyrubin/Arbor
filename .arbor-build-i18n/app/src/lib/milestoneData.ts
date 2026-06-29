import { Milestone } from "../types";

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
  cdc(24, "2 years", "language_communication", 5, "Names objects in a book", "Points to at least two body parts when you ask; uses gestures beyond waving and pointing.", "Can point out a nose or tummy and blows a kiss."),
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
 */
export const ASHA_MILESTONES: Milestone[] = [
  {
    id: "asha-feed-9m",
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
 * Arbor's own 4–6y surveillance items — the bilingual, regulation, and sensory
 * cues that the CDC set doesn't cover but the product cares about. Kept from the
 * original demo so the default profile (a 5-year-old in language transition)
 * still has relevant, editable open milestones. Like the CDC/ASHA rows these
 * seed UNobserved (`checked:false`) — nothing is "observed" until the parent
 * marks it, so a brand-new child never gets a silently inflated Development Score.
 */
export const ARBOR_EXTENDED_MILESTONES: Milestone[] = [
  { id: "m-1", domain: "attachment_regulation", ageMonths: 54, ageGroup: "Age 4-5", title: "Regulates with Prompting", description: "Can calm down within 15 minutes with warm adult co-regulation.", skillLooksLike: "After a meltdown, a calm adult presence helps them settle within a quarter of an hour.", checked: false },
  { id: "m-2", domain: "language_communication", ageMonths: 54, ageGroup: "Age 4-5", title: "Uses Full Sentences", description: "Speaks in sentences of 5-6 words, sharing clear thoughts on what they did during the day.", skillLooksLike: "Recaps their day in proper sentences you can easily follow.", checked: false },
  { id: "m-3", domain: "social_development", ageMonths: 54, ageGroup: "Age 4-5", title: "Imaginative Cooperative Play", description: "Plays 'makeup' games with other children, successfully negotiating simple rules.", skillLooksLike: "Invents a pretend game with friends and agrees on who plays what.", checked: false },
  { id: "m-4", domain: "independence_adaptive_skills", ageMonths: 54, ageGroup: "Age 4-5", title: "Dresses Independently", description: "Can button shirts, pull up pants, and arrange shoes with minimal direction.", skillLooksLike: "Gets dressed start-to-finish with only the odd reminder.", checked: false },
  { id: "m-5", domain: "sensory_motor_patterns", ageMonths: 54, ageGroup: "Age 4-5", title: "Hops on One Foot", description: "Balances and hops comfortably on one foot for 3-4 consecutive bounds.", skillLooksLike: "Hops several times on one foot without toppling over.", checked: false },

  { id: "m-6", domain: "attachment_regulation", ageMonths: 66, ageGroup: "Age 5-6", title: "Articulates Specific Feelings", description: "Can verbally name complex feelings: e.g., 'I am lonely,' 'I feel disappointed.'", skillLooksLike: "Names a nuanced feeling instead of just 'mad' or 'sad'.", checked: false },
  { id: "m-7", domain: "language_communication", ageMonths: 66, ageGroup: "Age 5-6", title: "Handles Code-Switching", description: "Can comfortably shift phrases between Hebrew and English depending on the listener.", skillLooksLike: "Switches language to match who they're talking to, without getting stuck.", checked: false },
  { id: "m-8", domain: "social_development", ageMonths: 66, ageGroup: "Age 5-6", title: "Conflict Resolution Process", description: "Suggests simple compromises when a toy dispute arises ('You play 5 mins, then me').", skillLooksLike: "Offers a fair trade or turn-taking idea to settle a squabble.", checked: false },
  { id: "m-9", domain: "cognition_executive_function", ageMonths: 66, ageGroup: "Age 5-6", title: "Time Sequencing", description: "Correctly sequences days, understand 'tomorrow vs yesterday', and basic morning schedule.", skillLooksLike: "Talks accurately about yesterday, today, and tomorrow and the day's order.", checked: false },
  { id: "m-10", domain: "sensory_motor_patterns", ageMonths: 66, ageGroup: "Age 5-6", title: "Manages Senses Pre-emptively", description: "Can say 'It is too loud here' and requests headphones or leaving space.", skillLooksLike: "Notices sensory overload coming and asks for a break or quiet.", checked: false },
];

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
export function bandForAgeMonths(ageMonths: number): { months: number; label: string } {
  let band = MILESTONE_AGE_BANDS[0];
  for (const b of MILESTONE_AGE_BANDS) {
    if (ageMonths >= b.months) band = b;
    else break;
  }
  return band;
}
