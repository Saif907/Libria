export type Book = {
  id: string;
  title: string;
  author: string;
  year: number;
  pages: number;
  collection: string;
  cover: { bg: string; fg: string; rule?: boolean };
  progress: number; // 0..1
  chapter: string;
  lastOpened: string;
  description: string;
  chapters: { id: string; title: string; words: number }[];
};

const chapterSet = (titles: string[]) =>
  titles.map((title, i) => ({
    id: `ch-${i + 1}`,
    title,
    words: 2400 + ((i * 733) % 2600),
  }));

export const books: Book[] = [
  {
    id: "scout-mindset",
    title: "The Scout Mindset",
    author: "Julia Galef",
    year: 2021,
    pages: 288,
    collection: "Psychology",
    cover: { bg: "oklch(0.44 0.05 158)", fg: "oklch(0.96 0.01 90)", rule: true },
    progress: 0.42,
    chapter: "5. Noticing Bias",
    lastOpened: "2 hours ago",
    description:
      "Why some people see things clearly and others don't. Galef separates the soldier mindset, which defends existing beliefs, from the scout mindset, which seeks an accurate map of reality — and argues the second can be trained.",
    chapters: chapterSet([
      "Two Types of Thinking",
      "What the Soldier Is Protecting",
      "Why Truth Is More Valuable",
      "Signs of a Scout",
      "Noticing Bias",
      "How Sure Are You?",
      "Coping with Reality",
      "Motivation Without Self-Deception",
    ]),
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    year: 2018,
    pages: 320,
    collection: "Personal",
    cover: { bg: "oklch(0.28 0.01 85)", fg: "oklch(0.94 0.02 92)" },
    progress: 0.78,
    chapter: "14. How to Make Good Habits Inevitable",
    lastOpened: "Yesterday",
    description:
      "A practical framework for behaviour change built on four laws — make it obvious, attractive, easy and satisfying — with an emphasis on systems and environment over motivation.",
    chapters: chapterSet([
      "The Surprising Power of Atomic Habits",
      "How Your Habits Shape Your Identity",
      "How to Build Better Habits",
      "The Man Who Didn't Look Right",
      "The Best Way to Start a New Habit",
      "Motivation Is Overrated; Environment Matters More",
      "The Secret to Self-Control",
    ]),
  },
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    year: 2016,
    pages: 304,
    collection: "Work",
    cover: { bg: "oklch(0.35 0.03 250)", fg: "oklch(0.95 0.01 90)", rule: true },
    progress: 0.15,
    chapter: "2. Deep Work Is Rare",
    lastOpened: "3 days ago",
    description:
      "An argument that focused, undistracted work is both increasingly rare and increasingly valuable, followed by four disciplines for cultivating it.",
    chapters: chapterSet([
      "Deep Work Is Valuable",
      "Deep Work Is Rare",
      "Deep Work Is Meaningful",
      "Work Deeply",
      "Embrace Boredom",
      "Quit Social Media",
      "Drain the Shallows",
    ]),
  },
  {
    id: "thinking-bets",
    title: "Thinking in Bets",
    author: "Annie Duke",
    year: 2018,
    pages: 288,
    collection: "Finance",
    cover: { bg: "oklch(0.5 0.09 61)", fg: "oklch(0.97 0.01 90)" },
    progress: 0,
    chapter: "Not started",
    lastOpened: "Added last week",
    description:
      "Decision-making under uncertainty, drawn from professional poker: separating the quality of a decision from the quality of its outcome.",
    chapters: chapterSet([
      "Life Is Poker, Not Chess",
      "Wanna Bet?",
      "Bet to Learn",
      "The Buddy System",
      "Dissent to Win",
      "Adventures in Mental Time Travel",
    ]),
  },
  {
    id: "psychology-money",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    year: 2020,
    pages: 256,
    collection: "Finance",
    cover: { bg: "oklch(0.93 0.03 92)", fg: "oklch(0.25 0.01 85)", rule: true },
    progress: 1,
    chapter: "Finished",
    lastOpened: "2 weeks ago",
    description:
      "Nineteen short stories about the strange ways people think about money, and why behaviour matters more than technical knowledge.",
    chapters: chapterSet([
      "No One's Crazy",
      "Luck & Risk",
      "Never Enough",
      "Confounding Compounding",
      "Getting Wealthy vs. Staying Wealthy",
      "Tails, You Win",
      "Freedom",
    ]),
  },
  {
    id: "range",
    title: "Range",
    author: "David Epstein",
    year: 2019,
    pages: 352,
    collection: "Psychology",
    cover: { bg: "oklch(0.46 0.08 24)", fg: "oklch(0.96 0.01 90)" },
    progress: 0.33,
    chapter: "4. Learning, Fast and Slow",
    lastOpened: "5 days ago",
    description:
      "Why generalists triumph in a specialised world: evidence that breadth of experience, slow learning and late specialisation produce better long-run performance.",
    chapters: chapterSet([
      "The Cult of the Head Start",
      "How the Wicked World Was Made",
      "When Less of the Same Is More",
      "Learning, Fast and Slow",
      "Thinking Outside Experience",
      "The Trouble with Too Much Grit",
    ]),
  },
  {
    id: "making-of-a-manager",
    title: "The Making of a Manager",
    author: "Julie Zhuo",
    year: 2019,
    pages: 288,
    collection: "Work",
    cover: { bg: "oklch(0.62 0.06 200)", fg: "oklch(0.15 0.01 85)" },
    progress: 0.06,
    chapter: "1. What Is Management?",
    lastOpened: "Last month",
    description:
      "A field guide to the first year of managing people, written from the perspective of someone who was promoted into it unprepared.",
    chapters: chapterSet([
      "What Is Management?",
      "Your First Three Months",
      "Leading a Small Team",
      "The Art of Feedback",
      "Managing Yourself",
    ]),
  },
  {
    id: "seeing-like-a-state",
    title: "Seeing Like a State",
    author: "James C. Scott",
    year: 1998,
    pages: 464,
    collection: "Personal",
    cover: { bg: "oklch(0.33 0.02 120)", fg: "oklch(0.93 0.02 92)", rule: true },
    progress: 0.21,
    chapter: "3. Authoritarian High Modernism",
    lastOpened: "3 weeks ago",
    description:
      "How certain schemes to improve the human condition have failed — an account of legibility, simplification and the loss of local knowledge.",
    chapters: chapterSet([
      "Nature and Space",
      "Cities, People, and Language",
      "Authoritarian High Modernism",
      "The High-Modernist City",
      "The Revolutionary Party",
      "Soviet Collectivization",
    ]),
  },
];

export const collections = ["Personal", "Finance", "Psychology", "Work"];

export const getBook = (id: string) => books.find((b) => b.id === id);

export const continueReading = books
  .filter((b) => b.progress > 0 && b.progress < 1)
  .sort((a, b) => b.progress - a.progress);

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
    bookId: "atomic-habits",
    chapter: "Chapter 1",
    note: "The clearest one-line version of the whole argument.",
    tags: ["systems", "habits"],
    date: "Aug 19",
  },
  {
    id: "h2",
    text: "What would it take to change my mind? If nothing would, the belief isn't tracking reality.",
    bookId: "scout-mindset",
    chapter: "Chapter 5",
    tags: ["epistemics"],
    date: "Aug 18",
  },
  {
    id: "h3",
    text: "Clarity about what matters provides clarity about what does not.",
    bookId: "deep-work",
    chapter: "Chapter 4",
    note: "Use as the filter for the quarterly planning doc.",
    tags: ["focus", "work"],
    date: "Aug 14",
  },
  {
    id: "h4",
    text: "Resulting: the tendency to equate the quality of a decision with the quality of its outcome.",
    bookId: "thinking-bets",
    chapter: "Chapter 1",
    tags: ["decisions"],
    date: "Aug 11",
  },
  {
    id: "h5",
    text: "Doing well with money has little to do with how smart you are and a lot to do with how you behave.",
    bookId: "psychology-money",
    chapter: "Introduction",
    tags: ["money", "behaviour"],
    date: "Aug 4",
  },
  {
    id: "h6",
    text: "Learning deeply means learning slowly. Desirable difficulties are the point, not an obstacle.",
    bookId: "range",
    chapter: "Chapter 4",
    note: "Directly contradicts the way I've been studying.",
    tags: ["learning"],
    date: "Jul 30",
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
    bookId: "atomic-habits",
    chapter: "Chapter 6",
    updated: "Aug 20",
  },
  {
    id: "n2",
    title: "Where Newport and Epstein disagree",
    body: "Newport wants deliberate, narrow, cumulative practice. Epstein argues that in wicked domains early narrowness produces brittle expertise. They are probably both right, scoped by domain kindness — the disagreement is about which domain you are in, not about practice itself.",
    updated: "Aug 17",
  },
  {
    id: "n3",
    title: "Calibration exercise",
    body: "Galef's equivalent bet test: before asserting a forecast, ask whether I'd take the bet at those odds with real money. Ran it against three work predictions this week; two collapsed immediately.",
    bookId: "scout-mindset",
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
    bookId: "atomic-habits",
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
    bookId: "scout-mindset",
    chapter: "Chapter 6",
    passage:
      "Try the equivalent bet test: would you rather bet on your belief being true, or draw a winning ball from an urn with a known composition?",
    interpretation:
      "Author claim drawing on the forecasting literature. The technique is a heuristic, not a validated instrument.",
    tags: ["epistemics", "decisions"],
  },
  {
    id: "i3",
    title: "Match practice structure to how kind the domain is",
    summary:
      "Fast feedback and stable rules reward narrow repetition. Ambiguous feedback rewards breadth and analogical thinking.",
    bookId: "range",
    chapter: "Chapter 1",
    passage:
      "In wicked domains, the rules of the game are often unclear or incomplete, there may or may not be repetitive patterns and they may not be obvious, and feedback is often delayed, inaccurate, or both.",
    userNote: "This is the reconciliation between Deep Work and Range.",
    interpretation:
      "Research cited by author (Hogarth's kind/wicked learning environments). Reasonably well-established framework in judgement research.",
    tags: ["learning", "expertise"],
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
    bookId: "atomic-habits",
    status: "Done",
  },
  {
    id: "a2",
    action: "Write probability estimates on the three open project bets",
    why: "Forces calibration before the outcome is known, so resulting can be detected later.",
    bookId: "thinking-bets",
    status: "In progress",
  },
  {
    id: "a3",
    action: "Block 09:00–11:30 as an unscheduled deep block, four days a week",
    why: "Depth requires protected, predictable time rather than leftover time.",
    bookId: "deep-work",
    status: "Not started",
  },
  {
    id: "a4",
    action: "Keep a running list of predictions I got wrong",
    why: "The scout mindset needs a record; memory reliably edits itself.",
    bookId: "scout-mindset",
    status: "In progress",
  },
];

export const openQuestions = [
  {
    id: "q1",
    question: "Is the four-laws framework testable, or is it a post-hoc description?",
    bookId: "atomic-habits",
  },
  {
    id: "q2",
    question: "How much of Deep Work's evidence is anecdote about knowledge workers?",
    bookId: "deep-work",
  },
  {
    id: "q3",
    question: "Does the kind/wicked distinction hold up outside judgement research?",
    bookId: "range",
  },
];

export const recentQuestions = [
  "What do my books say about discipline?",
  "Compare Atomic Habits and Deep Work on focus.",
  "Which books discuss risk under uncertainty?",
  "What methods for learning are supported by evidence?",
];

/* A short passage used by the reader */
export const passage = [
  "The first thing to understand about reasoning is that it is not, by default, an attempt to find out what is true. Most of the time, when we consider an argument, we are not weighing it. We are deciding whether we are obliged to accept it.",
  "Psychologists have a useful term for this: motivated reasoning. It describes the way our unconscious motives affect the conclusions we draw, even when we are entirely convinced that we are being objective. The motivation is rarely conscious, which is precisely what makes it difficult to notice.",
  "I find it clarifying to think of this in military terms. In soldier mindset, reasoning is a defensive operation. Some beliefs are ours, and we defend them; other beliefs belong to the enemy, and we attack them. The question we ask of a claim we like is <em>can I believe this?</em> The question we ask of a claim we dislike is <em>must I believe this?</em>",
  "The scout has a different job. The scout is not trying to attack or defend anything. The scout is trying to draw an accurate map — to find out what is actually there, whether or not the terrain is favourable. A scout who reports that the bridge is out is not being disloyal. They are doing the only thing that makes the map worth having.",
  "This distinction matters because the two mindsets feel identical from the inside. Soldier reasoning does not announce itself. It arrives wearing the clothes of careful analysis, complete with evidence, citations and a tone of measured reasonableness. You will not catch it by asking yourself whether you are being biased; you will simply answer no.",
  "What you can do instead is watch for the asymmetry. Notice how much scrutiny you apply to a study whose conclusion you welcome, compared with one whose conclusion you resent. Notice how quickly you accept a criticism of someone you dislike. The bias is invisible in any single judgement, but the asymmetry across judgements is often obvious once you look for it.",
  "None of this requires you to be dispassionate. Scouts have preferences; they would often rather the bridge were intact. The difference is that the scout does not let the preference decide the report.",
];
