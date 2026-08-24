# Marginalia — Main Pages & Features

The homepage and design system are in place. This plan builds the rest of the product: the reader, the grounded-chat layer, the audiobook mode, and the knowledge/annotation surfaces — all on the existing warm editorial token system so nothing feels bolted on.

## Design thesis

I looked at what the best-in-class tools actually get right, and where they fail a reader who wants library + reader + grounded AI + audio in one place:

- **Apple Books / Kindle** — the reading surface itself: fixed measure, no chrome, controls that fade. They fail at knowledge: highlights go to a dead list.
- **Readwise Reader** — three-pane density and inline annotation are excellent, but it looks like a tool, not a book.
- **Notion / Perplexity** — citation-first answers with visible sources. Perplexity's key lesson: an answer is only trustworthy when the source is one click away, shown inline, not footnoted.
- **Linear / Things 3** — restraint: hairline borders, one accent, no cards-in-cards. This is where the visual identity comes from.

Where my own judgment departs from those references:

1. **Chat is a companion panel, never a page.** A standalone "AI chat" page would turn a reading app into a ChatGPT wrapper. Instead, chat opens as a right-hand panel *anchored to what you are currently reading*, pre-scoped to this book/chapter/selection. Scope is always visible as a removable chip, so you can widen it to your whole library on purpose, never by accident.
2. **Every answer is a citation stack, not prose.** Answer text on top, then source passages with book, chapter, page — each clicking straight into the reader at that position. Ungrounded output is visually marked as such.
3. **Audio and text are one position, not two apps.** The mini player already in the shell is the truth; the reader highlights the sentence being spoken, and tapping any sentence seeks audio there. No separate audiobook library.
4. **Annotation is capture, Knowledge is synthesis.** Highlights/Notes stay raw and chronological. Knowledge is where the AI-derived layer lives — themes across books, contradictions between authors, open questions — always with sources attached.
5. **Aesthetic restraint as function.** Serif for book content, sans for interface — this single split tells you at a glance what is the author's voice and what is the app's. No gradients, no glow, no card shadows in reading areas.

## Pages to build

**Reader** `/read/$bookId`
Centered 700px measure, serif body, sidebars hidden. Floating top bar fades on scroll: back, chapter title, progress %, then contents / type settings / listen / ask. Text selection raises a compact inline toolbar: Highlight, Note, Ask, Copy. Left slide-over table of contents; type panel controls size, leading, width, theme. Sentence-level highlight when audio plays; click a sentence to seek.

**Ask panel** (component, opens over reader and knowledge pages)
Scope chip ("This chapter" / "This book" / "Library"), question input, answer stream, then citation cards using the existing `SourceReference` primitive. Suggested questions when empty. Recent questions persist per book.

**Book detail** `/book/$bookId`
Cover, title, author, progress, Resume / Listen / Ask actions, description, then chapter list with per-chapter progress, and this book's highlights and notes inline.

**Knowledge** `/knowledge`
The synthesis surface: themes across the library, contradictions between authors, open questions — every item source-attributed and expandable into the ask panel.

**Highlights** `/highlights` and **Notes** `/notes`
Chronological, book-grouped, filterable by book and color. Each row links to its exact position in the reader.

**Audio** `/audio`
Now playing with full transport, speed, sleep timer, plus queue and per-book listening progress — reusing the same book records.

**Saved** `/saved`, **Search** `/search`, **Settings** `/settings`, **Import** `/import`
Saved: pinned answers and passages. Search: one input across books, highlights, notes, and answers with typed result groups. Settings: reading defaults, voice, theme, AI scope defaults. Import: drop zone with per-file indexing state (upload → parse → index → ready).

## Technical notes

- New route files under `src/routes/`, using `createFileRoute` paths matching filenames (`read.$bookId.tsx` → `/read/$bookId`, `book.$bookId.tsx` → `/book/$bookId`). Every route gets its own `head()` with unique title/description/og tags.
- All UI reuses `src/components/app/primitives.tsx` and `AppShell`; new shared pieces (`AskPanel`, `SelectionToolbar`, `TypePanel`, `TocPanel`, `CitationCard`) are added there or under `src/components/app/`.
- Reader hides the shell rails and mini-player chrome via a focused variant rather than a second layout.
- Frontend only: all content comes from `src/lib/library-data.ts`, extended with chapters, an audio queue, and mock answer objects. Answer streaming is simulated client-side. No backend in this pass.
- Existing type fixes finished along the way: search-param access in `index.tsx`, `search` prop typing on collection links, and the Geist + Literata `<link>` tags plus app metadata in `__root.tsx`.
