import { books, getBook } from "./library-data";

/* ---------------- Scope ---------------- */

export type Scope = "selection" | "page" | "chapter" | "book" | "library";

export const scopeLabel: Record<Scope, string> = {
  selection: "Selected passage",
  page: "This page",
  chapter: "This chapter",
  book: "This book",
  library: "My library",
};

export const scopeOrder: Scope[] = [
  "selection",
  "page",
  "chapter",
  "book",
  "library",
];

/* ---------------- Evidence ---------------- */

export type Citation = {
  bookId: string;
  chapter: string;
  page: number;
  passage: string;
  relevance: string;
};

export type Grounding =
  | "grounded"
  | "synthesis"
  | "conflict"
  | "inference"
  | "not-found";

export const groundingLabel: Record<Grounding, string> = {
  grounded: "Grounded",
  synthesis: "Multi-source synthesis",
  conflict: "Conflicting evidence",
  inference: "Inference",
  "not-found": "Not found in library",
};

export type Perspective = {
  dimension: string;
  bookId: string;
  contribution: string;
};

export type Contradiction = {
  claim: string;
  counterClaim: string;
  claimBookId: string;
  counterBookId: string;
  reading: string;
};

export type Answer = {
  id: string;
  question: string;
  scope: Scope;
  grounding: Grounding;
  /** Paragraphs of the readable answer. */
  answer: string[];
  /** Optional note on how the sources were combined. */
  reasoning?: string;
  dimensions?: string[];
  perspectives?: Perspective[];
  agreements?: string[];
  contradictions?: Contradiction[];
  practical?: string[];
  citations: Citation[];
};

/* ---------------- Suggested questions ---------------- */

export const suggestions: Record<Scope, string[]> = {
  selection: [
    "What does the author mean here?",
    "Explain this in simpler language.",
    "What assumptions is this making?",
  ],
  page: [
    "What is the main idea on this page?",
    "How does this connect to the previous chapter?",
    "What should I remember from this?",
  ],
  chapter: [
    "Summarise this chapter's argument.",
    "What evidence does the author give?",
    "What is the weakest part of this chapter?",
  ],
  book: [
    "What is the author's central argument?",
    "What should I actually apply from this book?",
    "Where is this book weakest?",
  ],
  library: [
    "How can I build wealth by 30 without wasting my 20s?",
    "Which of my authors disagree about focus?",
    "What ideas keep appearing across my library?",
  ],
};

/* ---------------- Mock answers ---------------- */

export const answers: Answer[] = [
  {
    id: "ans-selection",
    question: "What does the author mean here?",
    scope: "selection",
    grounding: "grounded",
    answer: [
      "Galef is describing the difference between evaluating a claim and deciding whether you are obliged to accept it. In the first case the question is what the evidence supports; in the second, the conclusion is already chosen and reasoning is recruited to justify it.",
      "The practical test she offers is asymmetry: compare the scrutiny you apply to a claim you welcome with the scrutiny you apply to one you resent. Bias is invisible in a single judgement and obvious across many.",
    ],
    citations: [
      {
        bookId: "scout-mindset",
        chapter: "Chapter 5 · Noticing Bias",
        page: 82,
        passage:
          "The question we ask of a claim we like is can I believe this? The question we ask of a claim we dislike is must I believe this?",
        relevance: "Directly states the asymmetry described in the selection.",
      },
    ],
  },
  {
    id: "ans-page",
    question: "What is the author arguing on this page?",
    scope: "page",
    grounding: "grounded",
    answer: [
      "That motivated reasoning does not feel like bias from the inside. It arrives with evidence, citations and a reasonable tone, which is why introspection alone cannot detect it.",
      "The consequence is methodological: instead of asking whether you are biased, watch for uneven standards across judgements you have already made.",
    ],
    citations: [
      {
        bookId: "scout-mindset",
        chapter: "Chapter 5 · Noticing Bias",
        page: 81,
        passage:
          "Soldier reasoning does not announce itself. It arrives wearing the clothes of careful analysis.",
        relevance: "The page's core claim, stated by the author.",
      },
      {
        bookId: "scout-mindset",
        chapter: "Chapter 6 · How Sure Are You?",
        page: 96,
        passage:
          "Try the equivalent bet test: would you rather bet on your belief being true, or draw a winning ball from an urn with a known composition?",
        relevance: "The technique the chapter builds toward.",
      },
    ],
  },
  {
    id: "ans-book",
    question: "What should I actually apply from this book?",
    scope: "book",
    grounding: "grounded",
    answer: [
      "Three things carry most of the book's practical weight: state beliefs as probabilities you would bet on, keep a written record of predictions so memory cannot edit them, and treat changing your mind as a routine update rather than a defeat.",
      "Everything else in the book is support for those three moves.",
    ],
    citations: [
      {
        bookId: "scout-mindset",
        chapter: "Chapter 6 · How Sure Are You?",
        page: 96,
        passage:
          "Thinking in shades of grey is a skill, and like any skill it improves with feedback you actually collect.",
        relevance: "Basis for calibration and record-keeping.",
      },
      {
        bookId: "scout-mindset",
        chapter: "Chapter 8 · Motivation Without Self-Deception",
        page: 141,
        passage:
          "You can be motivated by a goal without needing to believe your odds are better than they are.",
        relevance: "Why updating does not cost motivation.",
      },
    ],
  },
  {
    id: "ans-library",
    question: "How can I build wealth by 30 without wasting my 20s?",
    scope: "library",
    grounding: "synthesis",
    dimensions: ["Wealth", "Career", "Behaviour", "Trade-offs"],
    reasoning:
      "Four books contribute to this question from different angles. Their claims are compatible on savings rate and compounding, and they diverge on how much of the present should be traded for the future.",
    answer: [
      "Across your library the reliable levers are behavioural rather than technical: a high savings rate maintained through variable income, a long enough horizon for compounding to matter, and enough optionality that you are never forced to sell at the wrong time.",
      "Career-side, the compounding asset in your twenties is rare and valuable skill, which is built with protected, focused time rather than with more hours. Your psychology books add the constraint the finance books do not: wealth whose only purpose is a future self tends to be spent poorly when it arrives.",
    ],
    perspectives: [
      {
        dimension: "Wealth",
        bookId: "psychology-money",
        contribution:
          "Behaviour dominates technique. Savings rate and staying power beat return-chasing; controlling your time is the highest dividend money pays.",
      },
      {
        dimension: "Career",
        bookId: "deep-work",
        contribution:
          "Income compounds through rare skill, and rare skill is produced by depth. Protect a predictable daily block rather than working longer.",
      },
      {
        dimension: "Behaviour",
        bookId: "atomic-habits",
        contribution:
          "Automate the mechanism: raise the transfer when income rises so the default does the saving instead of monthly intent.",
      },
      {
        dimension: "Trade-offs",
        bookId: "range",
        contribution:
          "Early over-specialisation can produce brittle bets. Sampling widely in your twenties is an investment, not a delay.",
      },
    ],
    agreements: [
      "Rate of saving matters far more than choice of investment for the first decade.",
      "Time and autonomy are the real return people are seeking, not a number.",
      "Systems and defaults outperform motivation across long horizons.",
    ],
    contradictions: [
      {
        claim:
          "Optimise hard and early; depth compounds, so narrow your focus now.",
        counterClaim:
          "Breadth and sampling produce better long-run fit; early narrowing is often a mistake.",
        claimBookId: "deep-work",
        counterBookId: "range",
        reading:
          "Both hold, scoped by domain. Narrow relentlessly where feedback is fast and rules are stable; sample where feedback is delayed or ambiguous.",
      },
      {
        claim: "Never enough — the goalpost moves, so define enough early.",
        counterClaim:
          "Aggressive accumulation is rational while returns compound most.",
        claimBookId: "psychology-money",
        counterBookId: "thinking-bets",
        reading:
          "Housel is arguing about the target, Duke about the process. Set the number deliberately, then optimise the process toward it.",
      },
    ],
    practical: [
      "Fix a savings rate as a percentage, and raise it automatically with every income increase.",
      "Protect one deep block each weekday for the skill that raises your income ceiling.",
      "Write down what 'enough' means in money and in hours, and revisit it once a year.",
      "Spend deliberately on the few things in your twenties that will not be available later.",
    ],
    citations: [
      {
        bookId: "psychology-money",
        chapter: "Chapter 10 · Save Money",
        page: 92,
        passage:
          "Wealth is the ability to do what you want, when you want, with who you want, for as long as you want.",
        relevance: "Reframes the target from a number to autonomy.",
      },
      {
        bookId: "psychology-money",
        chapter: "Chapter 4 · Confounding Compounding",
        page: 51,
        passage:
          "Good investing isn't about earning the highest returns. It's about earning pretty good returns you can stick with for the longest period of time.",
        relevance: "Supports duration over optimisation.",
      },
      {
        bookId: "deep-work",
        chapter: "Chapter 1 · Deep Work Is Valuable",
        page: 29,
        passage:
          "The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable.",
        relevance: "Career-side compounding mechanism.",
      },
      {
        bookId: "atomic-habits",
        chapter: "Chapter 6 · Environment Matters More",
        page: 82,
        passage:
          "Environment is the invisible hand that shapes human behavior.",
        relevance: "Mechanism for making the savings rate automatic.",
      },
      {
        bookId: "range",
        chapter: "Chapter 1 · The Cult of the Head Start",
        page: 21,
        passage:
          "In wicked domains, feedback is often delayed, inaccurate, or both.",
        relevance: "Constrains how early to specialise.",
      },
    ],
  },
  {
    id: "ans-conflict",
    question: "Which of my authors disagree about focus?",
    scope: "library",
    grounding: "conflict",
    reasoning:
      "Two books make opposing recommendations from compatible evidence. The disagreement is about domain, not about practice.",
    answer: [
      "Newport and Epstein disagree about how narrow attention should be. Newport treats depth as a cumulative asset and recommends aggressive narrowing; Epstein argues that in domains with delayed or noisy feedback, early narrowing produces brittle expertise.",
    ],
    contradictions: [
      {
        claim: "Depth is the asset. Narrow, protect the block, accumulate.",
        counterClaim:
          "Breadth transfers better where the rules of the game are unclear.",
        claimBookId: "deep-work",
        counterBookId: "range",
        reading:
          "Resolve by asking how kind your domain is before deciding how narrow to go.",
      },
    ],
    citations: [
      {
        bookId: "deep-work",
        chapter: "Chapter 4 · Work Deeply",
        page: 102,
        passage: "Clarity about what matters provides clarity about what does not.",
        relevance: "Newport's narrowing principle.",
      },
      {
        bookId: "range",
        chapter: "Chapter 4 · Learning, Fast and Slow",
        page: 85,
        passage:
          "Learning deeply means learning slowly. Desirable difficulties are the point.",
        relevance: "Epstein's counter-position.",
      },
    ],
  },
  {
    id: "ans-not-found",
    question: "What do my books say about tax-efficient retirement accounts?",
    scope: "library",
    grounding: "not-found",
    answer: [
      "Nothing in your library covers this. Your finance books are behavioural rather than technical — they discuss savings behaviour, risk and compounding, but not account structures or tax treatment.",
      "Treat any answer here as outside your sources.",
    ],
    citations: [],
  },
];

export const answerFor = (scope: Scope, question: string): Answer => {
  const q = question.toLowerCase();
  if (q.includes("disagree") || q.includes("contradict")) {
    return answers.find((a) => a.grounding === "conflict")!;
  }
  if (q.includes("tax") || q.includes("retirement account")) {
    return answers.find((a) => a.grounding === "not-found")!;
  }
  const byScope = answers.find((a) => a.scope === scope);
  if (byScope) return { ...byScope, question };
  return { ...answers.find((a) => a.scope === "library")!, question };
};

/* ---------------- Knowledge layer ---------------- */

export type Theme = {
  id: string;
  name: string;
  insight: string;
  bookIds: string[];
  passages: number;
};

export const themes: Theme[] = [
  {
    id: "t1",
    name: "Systems over intentions",
    insight:
      "Four of your authors independently argue that outcomes follow structure — environment, defaults, protected time — rather than resolve.",
    bookIds: ["atomic-habits", "deep-work", "psychology-money", "scout-mindset"],
    passages: 14,
  },
  {
    id: "t2",
    name: "Calibrated uncertainty",
    insight:
      "Confidence is treated as a quantity to be tested rather than a stance to defend, most explicitly through betting language.",
    bookIds: ["scout-mindset", "thinking-bets", "range"],
    passages: 9,
  },
  {
    id: "t3",
    name: "Time as the real currency",
    insight:
      "Money, focus and career decisions are all framed as purchases of autonomy over hours.",
    bookIds: ["psychology-money", "deep-work", "making-of-a-manager"],
    passages: 11,
  },
  {
    id: "t4",
    name: "Legibility destroys local knowledge",
    insight:
      "Simplifying a system to measure it removes the very information that made it work — appearing in both institutional and personal contexts.",
    bookIds: ["seeing-like-a-state", "range"],
    passages: 6,
  },
];

export const agreements = [
  {
    id: "ag1",
    claim: "Behaviour beats technique over long horizons.",
    bookIds: ["psychology-money", "atomic-habits", "scout-mindset"],
  },
  {
    id: "ag2",
    claim: "Feedback you actually collect is what turns experience into skill.",
    bookIds: ["thinking-bets", "range", "scout-mindset"],
  },
  {
    id: "ag3",
    claim: "Attention is a scarce input that must be defended structurally.",
    bookIds: ["deep-work", "atomic-habits"],
  },
];

export const libraryContradictions: Contradiction[] = [
  {
    claim: "Narrow early: depth is the compounding asset.",
    counterClaim: "Sample widely: breadth transfers in unclear domains.",
    claimBookId: "deep-work",
    counterBookId: "range",
    reading: "Scoped by how predictable feedback is in your domain.",
  },
  {
    claim: "Define 'enough' early, because the goalpost moves.",
    counterClaim: "Optimise aggressively while compounding has the most runway.",
    claimBookId: "psychology-money",
    counterBookId: "thinking-bets",
    reading: "One is about the target, the other about the process.",
  },
  {
    claim: "Grit and persistence are the differentiators.",
    counterClaim: "Quitting a poor fit early is usually the higher-value move.",
    claimBookId: "atomic-habits",
    counterBookId: "range",
    reading: "Both depend on whether the match has been tested at all yet.",
  },
];

export const librarySynthesis = [
  {
    id: "s1",
    question: "How can I build wealth by 30 without wasting my 20s?",
    sources: 5,
    bookCount: 4,
    conclusion:
      "Savings rate, protected deep work and a deliberate definition of enough — not investment selection.",
    answerId: "ans-library",
  },
  {
    id: "s2",
    question: "Which of my authors disagree about focus?",
    sources: 2,
    bookCount: 2,
    conclusion:
      "Newport and Epstein disagree about domain, not about the value of practice.",
    answerId: "ans-conflict",
  },
];

/* ---------------- Audio ---------------- */

export type AudioItem = {
  bookId: string;
  chapter: string;
  duration: string;
  elapsed?: string;
  progress?: number;
};

export const nowPlaying: AudioItem = {
  bookId: "scout-mindset",
  chapter: "Chapter 5 · Noticing Bias",
  duration: "31:48",
  elapsed: "12:04",
  progress: 0.38,
};

export const audioQueue: AudioItem[] = [
  { bookId: "scout-mindset", chapter: "Chapter 6 · How Sure Are You?", duration: "28:12" },
  { bookId: "scout-mindset", chapter: "Chapter 7 · Coping with Reality", duration: "24:39" },
  { bookId: "atomic-habits", chapter: "Chapter 14 · Making Habits Inevitable", duration: "19:05" },
];

export const continueListening: AudioItem[] = [
  { bookId: "atomic-habits", chapter: "Chapter 13", duration: "9:12:40", progress: 0.71 },
  { bookId: "psychology-money", chapter: "Chapter 19", duration: "5:48:10", progress: 1 },
  { bookId: "range", chapter: "Chapter 4", duration: "10:22:05", progress: 0.29 },
];

/* ---------------- Saved ---------------- */

export type SavedItem = {
  id: string;
  kind: "Passage" | "Answer" | "Insight" | "Synthesis" | "Plan";
  title: string;
  body: string;
  bookId?: string;
  chapter?: string;
  date: string;
};

export const savedItems: SavedItem[] = [
  {
    id: "sv1",
    kind: "Synthesis",
    title: "Wealth by 30 without losing the decade",
    body: "Savings rate over selection, protected deep work for skill, and a written definition of enough.",
    date: "Aug 22",
  },
  {
    id: "sv2",
    kind: "Passage",
    title: "Wealth is the ability to do what you want",
    body: "Wealth is the ability to do what you want, when you want, with who you want, for as long as you want.",
    bookId: "psychology-money",
    chapter: "Chapter 10",
    date: "Aug 20",
  },
  {
    id: "sv3",
    kind: "Answer",
    title: "Why motivated reasoning is invisible from inside",
    body: "It arrives with evidence and a reasonable tone; only asymmetry across judgements reveals it.",
    bookId: "scout-mindset",
    chapter: "Chapter 5",
    date: "Aug 19",
  },
  {
    id: "sv4",
    kind: "Insight",
    title: "Match practice structure to domain kindness",
    body: "Fast, stable feedback rewards narrow repetition; ambiguous feedback rewards breadth.",
    bookId: "range",
    chapter: "Chapter 1",
    date: "Aug 15",
  },
  {
    id: "sv5",
    kind: "Plan",
    title: "Automatic savings escalation",
    body: "Raise the standing transfer by the same percentage as any income increase, on the day it lands.",
    bookId: "atomic-habits",
    chapter: "Chapter 6",
    date: "Aug 11",
  },
];

/* ---------------- Reader content ---------------- */

export type ReaderChapter = {
  id: string;
  title: string;
  page: number;
  audio: string;
  progress: number;
  paragraphs: string[];
};

const splitSentences = (p: string) =>
  p.split(/(?<=\.)\s+/).filter((s) => s.trim().length > 0);

export const sentencesOf = splitSentences;

export const bookTitleOf = (bookId: string) => getBook(bookId)?.title ?? bookId;

export const bookAuthorOf = (bookId: string) => getBook(bookId)?.author ?? "";

export const libraryBookCount = books.length;
