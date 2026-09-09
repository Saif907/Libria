/**
 * Placeholder content for features with no backend yet: highlights, notes,
 * knowledge synthesis and actions. Books themselves are no longer here — they
 * come from GCS via the server functions in books.ts.
 *
 * `bookId` values point at real library slugs so the Highlights and Notes tabs
 * resolve against real books. When the backend starts serving this data, this
 * whole module goes away.
 */

import { coverFor, titleAndAuthorFromId, type BookCoverStyle } from "./books";

/**
 * Minimal book identity for the pages that only need a title, author or cover
 * and have no loader of their own. Derived from the slug — the
 * `<title>_by_<author>` filename convention makes this exact, so there is no
 * second source of truth competing with the bucket.
 */
export type BookRef = {
  id: string;
  title: string;
  author: string;
  cover: BookCoverStyle;
};

/**
 * The mock Ask/Knowledge/Audio fixtures were written against short slugs. Those
 * that name a book actually in the library are re-pointed here, so their links
 * open the real book instead of 404ing. Three fixture books — Range, Seeing
 * Like a State and The Making of a Manager — are not in the library and are
 * deliberately left unmapped rather than re-attributed to a real author.
 */
const LEGACY_ID_ALIASES: Record<string, string> = {
  "atomic-habits": "atomic_habits_by_james_clear",
  "deep-work": "deep_work_by_cal_newport",
  "psychology-money": "the_psychology_of_money_by_morgan_housel",
  "scout-mindset": "the_scout_mindset_by_julia_galef",
  "thinking-bets": "thinking_in_bets_by_annie_duke",
};

export const getBook = (id: string): BookRef => {
  const resolved = LEGACY_ID_ALIASES[id] ?? id;
  return {
    id: resolved,
    ...titleAndAuthorFromId(resolved),
    cover: coverFor(resolved),
  };
};

export type Highlight = {
  id: string;
  text: string;
  bookId: string;
  chapter: string;
  note?: string;
  tags: string[];
  date: string;
};

export const highlights: Highlight[] = [
  {
    id: "h1",
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    bookId: "atomic_habits_by_james_clear",
    chapter: "Chapter 1",
    note: "The clearest one-line version of the whole argument.",
    tags: ["systems", "habits"],
    date: "Aug 19",
  },
  {
    id: "h2",
    text: "What would it take to change my mind? If nothing would, the belief isn't tracking reality.",
    bookId: "the_scout_mindset_by_julia_galef",
    chapter: "Chapter 5",
    tags: ["epistemics"],
    date: "Aug 18",
  },
  {
    id: "h3",
    text: "Clarity about what matters provides clarity about what does not.",
    bookId: "deep_work_by_cal_newport",
    chapter: "Chapter 4",
    note: "Use as the filter for the quarterly planning doc.",
    tags: ["focus", "work"],
    date: "Aug 14",
  },
  {
    id: "h4",
    text: "Resulting: the tendency to equate the quality of a decision with the quality of its outcome.",
    bookId: "thinking_in_bets_by_annie_duke",
    chapter: "Chapter 1",
    tags: ["decisions"],
    date: "Aug 11",
  },
  {
    id: "h5",
    text: "Doing well with money has little to do with how smart you are and a lot to do with how you behave.",
    bookId: "the_psychology_of_money_by_morgan_housel",
    chapter: "Introduction",
    tags: ["money", "behaviour"],
    date: "Aug 4",
  },
];

export type Note = {
  id: string;
  title: string;
  body: string;
  bookId?: string;
  chapter?: string;
  updated: string;
};

export const notes: Note[] = [
  {
    id: "n1",
    title: "Environment design for the morning block",
    body: "Clear's fourth law only works if the cue is physically present. Concretely: laptop closed and in the drawer the night before, book on the chair, phone charging in the kitchen. The friction differential is what does the work — not the intention.",
    bookId: "atomic_habits_by_james_clear",
    chapter: "Chapter 6",
    updated: "Aug 20",
  },
  {
    id: "n2",
    title: "Where Newport and Duke disagree on planning",
    body: "Newport wants deliberate, narrow, cumulative practice on a chosen bet. Duke argues the bet itself should stay probabilistic and revisable. They are probably both right, scoped by how reversible the commitment is — the disagreement is about the cost of switching, not about practice itself.",
    updated: "Aug 17",
  },
  {
    id: "n3",
    title: "Calibration exercise",
    body: "Galef's equivalent bet test: before asserting a forecast, ask whether I'd take the bet at those odds with real money. Ran it against three work predictions this week; two collapsed immediately.",
    bookId: "the_scout_mindset_by_julia_galef",
    chapter: "Chapter 6",
    updated: "Aug 12",
  },
];

export type Insight = {
  id: string;
  title: string;
  summary: string;
  bookId: string;
  chapter: string;
  passage: string;
  userNote?: string;
  interpretation: string;
  tags: string[];
};

export const insights: Insight[] = [
  {
    id: "i1",
    title: "Better environments beat relying on motivation",
    summary:
      "Behaviour follows the path of least friction. Changing the surroundings changes the default, and defaults outperform willpower over long horizons.",
    bookId: "atomic_habits_by_james_clear",
    chapter: "Chapter 6",
    passage:
      "Environment is the invisible hand that shapes human behavior. Despite our unique personalities, certain behaviors tend to arise again and again under certain environmental conditions.",
    userNote: "Applies to my phone use more than to any 'productivity' habit.",
    interpretation:
      "Author claim, supported in the text by observational studies of consumer behaviour rather than controlled trials. Treat the direction as well-supported and the effect size as unspecified.",
    tags: ["habits", "environment"],
  },
  {
    id: "i2",
    title: "Confidence should be a claim about calibration, not identity",
    summary:
      "Stating a probability you would actually bet on separates the belief from the ego that defends it.",
    bookId: "the_scout_mindset_by_julia_galef",
    chapter: "Chapter 6",
    passage:
      "Try the equivalent bet test: would you rather bet on your belief being true, or draw a winning ball from an urn with a known composition?",
    interpretation:
      "Author claim drawing on the forecasting literature. The technique is a heuristic, not a validated instrument.",
    tags: ["epistemics", "decisions"],
  },
  {
    id: "i3",
    title: "Judge the decision, not the outcome",
    summary:
      "A good decision can lose and a bad one can win. Reviewing process separately from result is what makes experience teach anything.",
    bookId: "thinking_in_bets_by_annie_duke",
    chapter: "Chapter 1",
    passage:
      "Resulting is our tendency to equate the quality of a decision with the quality of its outcome, which makes luck invisible and learning unreliable.",
    userNote: "This is the reconciliation between planning and uncertainty.",
    interpretation:
      "Author claim drawn from professional poker and the judgement literature. Well-established as a framework, not a measured effect.",
    tags: ["decisions", "learning"],
  },
];

export type Action = {
  id: string;
  action: string;
  why: string;
  bookId: string;
  status: "Not started" | "In progress" | "Done";
};

export const actions: Action[] = [
  {
    id: "a1",
    action: "Move the phone charger out of the bedroom",
    why: "Removes the strongest morning cue before intention has to intervene.",
    bookId: "atomic_habits_by_james_clear",
    status: "Done",
  },
  {
    id: "a2",
    action: "Write probability estimates on the three open project bets",
    why: "Forces calibration before the outcome is known, so resulting can be detected later.",
    bookId: "thinking_in_bets_by_annie_duke",
    status: "In progress",
  },
  {
    id: "a3",
    action: "Block 09:00–11:30 as an unscheduled deep block, four days a week",
    why: "Depth requires protected, predictable time rather than leftover time.",
    bookId: "deep_work_by_cal_newport",
    status: "Not started",
  },
  {
    id: "a4",
    action: "Keep a running list of predictions I got wrong",
    why: "The scout mindset needs a record; memory reliably edits itself.",
    bookId: "the_scout_mindset_by_julia_galef",
    status: "In progress",
  },
];

export const openQuestions = [
  {
    id: "q1",
    question: "Is the four-laws framework testable, or is it a post-hoc description?",
    bookId: "atomic_habits_by_james_clear",
  },
  {
    id: "q2",
    question: "How much of Deep Work's evidence is anecdote about knowledge workers?",
    bookId: "deep_work_by_cal_newport",
  },
  {
    id: "q3",
    question: "Does the equivalent-bet test survive contact with real decisions?",
    bookId: "thinking_in_bets_by_annie_duke",
  },
];

export const recentQuestions = [
  "What do my books say about discipline?",
  "Compare Atomic Habits and Deep Work on focus.",
  "Which books discuss risk under uncertainty?",
  "What methods for learning are supported by evidence?",
];

/**
 * Sample prose for the audio page, which has no real TTS behind it yet. The
 * reader no longer uses this — it renders the actual book markdown from GCS.
 */
export const passage = [
  "The first thing to understand about reasoning is that it is not, by default, an attempt to find out what is true. Most of the time, when we consider an argument, we are not weighing it. We are deciding whether we are obliged to accept it.",
  "Psychologists have a useful term for this: motivated reasoning. It describes the way our unconscious motives affect the conclusions we draw, even when we are entirely convinced that we are being objective. The motivation is rarely conscious, which is precisely what makes it difficult to notice.",
  "I find it clarifying to think of this in military terms. In soldier mindset, reasoning is a defensive operation. Some beliefs are ours, and we defend them; other beliefs belong to the enemy, and we attack them. The question we ask of a claim we like is <em>can I believe this?</em> The question we ask of a claim we dislike is <em>must I believe this?</em>",
  "The scout has a different job. The scout is not trying to attack or defend anything. The scout is trying to draw an accurate map — to find out what is actually there, whether or not the terrain is favourable. A scout who reports that the bridge is out is not being disloyal. They are doing the only thing that makes the map worth having.",
  "This distinction matters because the two mindsets feel identical from the inside. Soldier reasoning does not announce itself. It arrives wearing the clothes of careful analysis, complete with evidence, citations and a tone of measured reasonableness. You will not catch it by asking yourself whether you are being biased; you will simply answer no.",
  "What you can do instead is watch for the asymmetry. Notice how much scrutiny you apply to a study whose conclusion you welcome, compared with one whose conclusion you resent. Notice how quickly you accept a criticism of someone you dislike. The bias is invisible in any single judgement, but the asymmetry across judgements is often obvious once you look for it.",
  "None of this requires you to be dispassionate. Scouts have preferences; they would often rather the bridge were intact. The difference is that the scout does not let the preference decide the report.",
];
