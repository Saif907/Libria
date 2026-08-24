# Marginalia — Main Pages & Features

The homepage and design system are already in place. This phase builds the rest of the product: the immersive reader, contextual AI, multi-book reasoning, audiobook experience, knowledge layer, annotations, search, saved material, and actionable insights — all on the existing warm editorial token system so nothing feels bolted on.

The core product idea is:

> **Read deeply → ask naturally → connect evidence across books → understand → act.**

Marginalia should feel like a beautiful reading application first, and an intelligent research/knowledge companion second. The books remain the source of truth; AI helps the reader understand, compare, synthesize, and apply what is in them.

---

## Design thesis

I looked at what the best-in-class tools get right, and where they fail a reader who wants library + reader + grounded AI + audio in one place:

- **Apple Books / Kindle** — excellent reading surfaces: fixed measure, minimal chrome, controls that fade. They don't make the knowledge contained in a large personal library especially useful.
- **Readwise Reader** — excellent annotation and information density, but it feels like a research tool rather than a book.
- **Notion / Perplexity** — strong information presentation and citation-first answers. The important lesson is that evidence must be one click away and visibly connected to the answer.
- **Linear / Things 3** — restraint: hairline borders, one accent, clear hierarchy, no cards-in-cards. That restraint informs the visual identity.

Where Marginalia departs from all of them:

### 1. AI is a reading companion, not a standalone chatbot

The primary AI surface is a right-hand **Ask panel** anchored to the user's current context.

The user can start with a specific passage and gradually widen the reasoning scope:

`Selection → Page → Chapter → Book → Library`

The scope is always visible and explicit.

The app should never silently turn a question about one passage into a library-wide answer.

A standalone `/ask` route may exist for broad library questions, but it should not feel like the primary product surface.

### 2. Contextual Ask is a core reading interaction

While reading, the user can ask about exactly what is in front of them.

There are three primary entry points:

**Select → Ask**

The selected sentence or passage becomes the primary context.

**Page → Ask**

With nothing selected, Ask uses the current reading position and surrounding passage.

**Book / Library → Ask**

The user deliberately expands the scope for broader reasoning.

When Ask opens from a selection, the panel should show the selected passage at the top so the user can immediately see what the AI is looking at.

### 3. Answers are evidence-backed synthesis, not generic prose

The answer should remain readable and natural, but important claims should be supported by visible evidence.

A response can be:

- single-source
- multi-source synthesis
- comparative
- contradictory
- inferential
- unsupported by the library

The UI should communicate which state applies.

Example:

`Library · 7 sources · Multi-book synthesis`

Then:

**Answer**

Readable synthesis.

**Evidence**

Relevant passages.

**Sources**

Book / author / chapter / page / location.

**Jump to source**

Opens the exact position in the reader.

### 4. Multi-book reasoning is a first-class capability

Some questions are inherently cross-disciplinary.

For example:

> “How can I become financially wealthy by 30 while still enjoying and living a satisfying life in my 20s?”

Marginalia should be able to reason across:

`Finance → Career → Psychology → Lifestyle → Trade-offs`

The answer shouldn't merely concatenate summaries from different books.

It should identify:

- supporting ideas
- complementary ideas
- disagreements
- constraints
- recurring principles
- practical synthesis

The UI should make this understandable without exposing technical RAG implementation details.

### 5. Disagreement is as valuable as agreement

The system should never manufacture consensus.

When books disagree, surface it explicitly:

**Where they agree**

Shared principles.

**Where they disagree**

Material differences between authors.

**What remains uncertain**

Questions the library cannot resolve confidently.

This should be visible in Knowledge and in multi-book Ask answers.

### 6. Audio and text share one position

There is no separate audiobook universe.

The book, chapter, text position, and audio position are the same underlying reading state.

Audio playback highlights the current sentence.

Tapping a sentence seeks the audio.

Changing chapters updates both.

### 7. Annotation is capture; Knowledge is synthesis

Highlights and Notes represent the reader's raw material.

Knowledge represents AI-derived synthesis.

The two should remain visually and conceptually distinct.

### 8. Knowledge should lead to action

The system should let a user turn a grounded insight into something they can actually do.

The long-term loop is:

**Read → Highlight → Ask → Synthesize → Verify → Save → Act**

### 9. Aesthetic restraint is functional

Use serif for book content and sans-serif for interface content.

This instantly distinguishes the author's voice from Marginalia's voice.

Reading areas should have:

- no gradients
- no glow
- minimal shadows
- restrained borders
- very few floating elements
- generous whitespace

---

# Pages to build

## Reader `/read/$bookId`

The reader is the emotional center of the product.

Centered approximately 700px reading measure.

Serif body.

Minimal persistent chrome.

Sidebars hidden by default.

### Floating top bar

Fades in on movement / tap:

`Back · Book / Chapter · Progress % · Contents · Type · Listen · Ask`

### Text selection

Selecting text raises a compact toolbar:

`Highlight · Note · Ask · Copy`

Selecting **Ask** immediately opens the Ask panel with the selected passage attached.

### Contextual Ask behavior

When the user selects text:

```text
Selected passage
↓
Ask
↓
"Explain what the author means here."

```

The Ask panel shows the selected passage as the active context.

When no text is selected:

```text
Current page
↓
Ask
↓
"What is the author arguing here?"

```

The system uses the current page / nearby passages as context.

The user can then widen scope:

`Selection → Page → Chapter → Book → Library`

### Example contextual questions

For a selected passage:

- What does the author mean here?
- Explain this in simpler language.
- Why does the author believe this?
- What assumptions are being made?
- Give me a practical example.

For a page:

- What is the main idea here?
- How does this connect to the previous chapter?
- What should I remember from this page?

The current reading context should remain active through follow-up questions until the user changes scope.

### Table of contents

Left slide-over showing:

- chapters
- current chapter
- reading progress
- optional audiobook duration

### Type panel

Controls:

- font size
- leading
- reading width
- theme
- paragraph spacing
- font

### Audio synchronization

When audio is playing:

- current sentence highlights
- reader follows the spoken position
- tapping a sentence seeks audio
- audio and text always share one position

---

# Ask panel

The Ask panel is a shared component that opens over:

- Reader
- Book detail
- Knowledge
- Search
- Saved
- other relevant surfaces

It should feel like an intelligent margin, not a chat application.

### Scope chip

Always display current scope.

Possible states:

`Selected passage`

`This page`

`This chapter`

`This book`

`My library`

The user can widen or narrow scope explicitly.

### Context preview

When launched from the reader, show the current context at the top:

```text
Reading context
Selected passage · Chapter 4 · p. 82

```

or:

```text
Reading context
Current page · Chapter 4 · p. 82

```

This makes the grounding boundary obvious.

### Empty state

Suggested questions change based on scope.

For a selection:

> What does the author mean here?

> Explain this simply.

> Why is this important?

For a book:

> What is the author's central argument?

> What should I actually apply from this book?

For the library:

> What do my books say about wealth?

> Which authors disagree about productivity?

> What ideas keep appearing across my library?

### Answer structure

Responses use:

**Answer**

Natural, readable explanation.

**Reasoning / synthesis**

Optional high-level explanation of the relationship between sources.

**Evidence**

Relevant source passages.

**Sources**

Book / chapter / page / location.

### Grounding states

Show one of:

`Grounded`

`Multi-source synthesis`

`Conflicting evidence`

`Inference`

`Not found in library`

The interface should not make an unsupported answer look equivalent to a directly sourced claim.

### Recent questions

Questions persist by book and optionally by library context.

Do not make the history feel like a giant ChatGPT transcript.

Prioritize useful previous questions over chat-log density.

---

# Multi-book reasoning experience

This is one of Marginalia's defining features.

A broad question should be represented as a synthesis problem rather than a generic chat response.

Example:

> “How can I be rich by 30 while still enjoying my 20s?”

The UI may show:

### Your question

The original question.

### Dimensions considered

`Wealth`

`Career`

`Lifestyle`

`Trade-offs`

### Sources considered

`8 books`

`14 relevant passages`

### Synthesis

Readable answer combining evidence from the relevant books.

### Perspectives

**Finance**

What financial books contribute.

**Career**

What career books contribute.

**Lifestyle / psychology**

What those books contribute.

### Agreements

Principles supported by multiple sources.

### Contradictions

Where authors materially disagree.

### Practical synthesis

A clearly marked section translating the evidence into a practical strategy.

The distinction should remain clear between:

**What the books say**

and

**How Marginalia synthesized them**

That distinction is critical for trust.

---

# Citation system

Create a reusable `SourceReference` / `CitationCard` primitive.

Every citation should support:

- cover thumbnail
- title
- author
- chapter
- page / location
- short passage preview
- open in reader
- optional “why this source?” interaction

Clicking it opens the exact location in `/read/$bookId`.

Citations should be reusable in:

- Ask
- Knowledge
- Saved
- Search
- Actions
- comparisons
- contradiction views

The evidence primitive is one of the most important shared components in the entire application.

---

# Book detail `/book/$bookId`

Book detail connects library browsing to reading.

### Header

Cover

Title

Author

Progress

Primary actions:

`Resume · Listen · Ask`

Secondary actions:

`Save · More`

### Description

Book description / metadata.

### Chapters

Each chapter row shows:

- title
- reading progress
- audio duration
- completion state

### Your material

Show:

- highlights
- notes
- saved passages
- recent questions

Every item links back to its exact position in the reader.

---

# Knowledge `/knowledge`

Knowledge answers:

> **What does my library collectively suggest?**

It should not be a generic collection of AI summaries.

### Themes

Recurring ideas across books.

Examples:

`Wealth`

`Discipline`

`Focus`

`Relationships`

`Creativity`

Each theme can expose:

- number of relevant books
- representative evidence
- synthesized insight

### Agreements

Ideas that several authors independently support.

### Contradictions

Important disagreements.

Example:

`Optimize aggressively for future wealth`

versus

`Do not sacrifice the present for an imagined future`

### Open questions

Questions for which the library provides incomplete or conflicting evidence.

### Recent synthesis

Recent cross-book questions that produced meaningful conclusions.

Any Knowledge item can open Ask with the relevant evidence already scoped.

---

# Highlights `/highlights`

Highlights remain raw captured material.

Chronological and book-grouped.

Filters:

`All`

`Book`

`Color`

`Recent`

Each row shows enough surrounding context to retain meaning.

Clicking opens the exact reader position.

Do not automatically transform every highlight into AI knowledge.

---

# Notes `/notes`

Notes represent the reader's own thinking.

Show:

- note
- related highlight
- book
- chapter
- location
- creation date

The visual treatment should clearly separate the user's own voice from AI-generated synthesis.

---

# Actions `/actions`

Actions turn grounded knowledge into behavior.

An action can come from:

- a highlight
- a note
- a question
- a multi-book synthesis
- a Knowledge item

Example:

**Action**

> Increase monthly investments when income increases.

**Derived from**

A financial principle synthesized across several books.

**Evidence**

`Book A · Chapter 5`

`Book B · Chapter 9`

### Action states

`Inbox`

`Planned`

`Active`

`Completed`

Actions retain their source evidence permanently.

This creates:

**Knowledge → Action → Behavior**

without disconnecting the action from the books that inspired it.

---

# Audio `/audio`

The audiobook experience uses the same book records and progress as the reader.

### Now Playing

Cover

Title

Author

Chapter

Current sentence

Progress

### Transport

- play / pause
- seek
- previous / next
- speed
- sleep timer

### Queue

Allow users to queue:

- chapters
- books

### Continue listening

Show active books with audio progress.

No separate audiobook library.

---

# Saved `/saved`

Saved material includes:

- passages
- answers
- insights
- synthesis results
- action plans

Keep lightweight type labels so the user knows what they saved.

---

# Search `/search`

One search surface across:

- books
- chapters
- passages
- highlights
- notes
- questions
- answers
- Knowledge
- saved content
- actions

Typed result groups:

`BOOK`

`PASSAGE`

`HIGHLIGHT`

`NOTE`

`ANSWER`

`INSIGHT`

`ACTION`

The frontend should support the shape of both conventional and semantic search even though backend retrieval is not implemented in this phase.

---

# Import `/import`

Import communicates that Marginalia is constructing a searchable personal library.

Drop zone.

Per-file processing states:

`Uploading → Parsing → Processing → Indexing → Ready`

Each file can show:

- title
- author
- cover
- processing status
- chapter count
- audio availability
- error state

---

# Settings `/settings`

### Reading

Font

Size

Leading

Width

Theme

### Audio

Voice

Playback speed

Sleep behavior

### AI

Default scope

Answer verbosity

Citation behavior

Synthesis preferences

### Library

Sorting

Metadata

Import defaults

### General

Application preferences

Keep Settings utilitarian and dense.

---

# Shared frontend components

Build shared primitives rather than route-specific implementations.

Suggested components:

`AskPanel`

`ScopeChip`

`ContextPreview`

`AnswerBlock`

`GroundingBadge`

`CitationCard`

`SourceReference`

`SourcePassage`

`SelectionToolbar`

`TypePanel`

`TocPanel`

`AudioMiniPlayer`

`AudioPlayer`

`ProgressBar`

`BookCard`

`ChapterRow`

`HighlightRow`

`NoteRow`

`InsightCard`

`ContradictionCard`

`ActionCard`

`SearchResult`

`LibraryFilter`

`EmptyState`

`ReaderShell`

The most important shared primitives are:

**Scope**

**Evidence**

**Reader position**

Because those three concepts connect almost every part of the application.

---

# Application shell

Continue using the existing `AppShell`, but add a focused reading variant.

### Normal shell

Library navigation

Mini player

Primary navigation

### Reader shell

Hide most navigation.

Keep only:

- back
- reading controls
- progress
- audio access
- Ask

Ask and audio should be able to appear without forcing a return to the normal shell.

The focused reader should feel like a mode of the same application rather than a second application.

---

# Frontend mock data

There is no backend requirement for this design pass.

Use `src/lib/library-data.ts` with realistic records for:

- books
- chapters
- passages
- sentence positions
- highlights
- notes
- audio queue
- questions
- answers
- citations
- insights
- contradictions
- actions

The mock answer system should include:

### Single-book answer

A question answered from one source.

### Passage-level answer

A question grounded specifically in selected text.

### Page-level answer

A question grounded in the current reading position.

### Multi-book synthesis

An answer drawing evidence from several books.

### Cross-book comparison

Different authors answering the same concept.

### Contradictory evidence

Sources that materially disagree.

### Unsupported question

A clear “not found in your library” state.

### Actionable synthesis

A grounded answer converted into practical next steps.

Answer streaming can be simulated client-side.

No backend is needed for this pass.

---

# Data relationships

Design the frontend around objects that map cleanly to the eventual backend.

```text
Book
 ├── Chapters
 │    └── Passages
 │         └── Sentences
 ├── Highlights
 ├── Notes
 └── AudioPosition

Question
 └── Answer
      ├── Citations
      ├── Sources
      └── Insights
            ├── Supporting evidence
            ├── Contradicting evidence
            └── Actions

```

The critical principle is:

> **AI-generated objects must retain links back to the exact evidence that produced them.**

An answer should never exist as an isolated text blob.

---

# Technical notes

- New route files go under `src/routes/`, using `createFileRoute` paths matching filenames such as `read.$bookId.tsx → /read/$bookId` and `book.$bookId.tsx → /book/$bookId`.
- Every route gets its own `head()` with unique title, description, and OG metadata.
- Reuse `src/components/app/primitives.tsx` and `AppShell`.
- Add shared pieces under `src/components/app/`, especially `AskPanel`, `ScopeChip`, `ContextPreview`, `SelectionToolbar`, `TypePanel`, `TocPanel`, and `CitationCard`.
- Reader hides shell rails and unnecessary mini-player chrome through a focused shell variant rather than creating a separate application layout.
- Extend `src/lib/library-data.ts` with realistic chapters, passages, sentence-level positions, highlights, notes, audio state, mock questions, multi-source answers, citations, contradictions, insights, and actions.
- Simulate answer streaming client-side.
- No backend implementation is required in this frontend pass.
- Existing type fixes remain: search-param access in `index.tsx`, `search` prop typing on collection links, and Geist + Literata `<link>` tags plus app metadata in `__root.tsx`.

---

# Build priority

Build the experience in this order:

## Phase 1 — The core reading loop

Reader

Selection toolbar

Contextual Ask

Citation cards

Book detail

Audio/text synchronization

## Phase 2 — Multi-book intelligence

Library-scoped Ask

Multi-source synthesis

Comparison states

Contradiction states

Knowledge

## Phase 3 — Personal knowledge

Highlights

Notes

Saved

Search

## Phase 4 — Action layer

Insights

Actions

Insight → Action flow

## Phase 5 — Library operations

Audio queue

Import

Settings

Advanced filtering

Polish

The single most important prototype flow is:

**Open book → read → select a passage → Ask → understand it → widen to the chapter/book/library → compare with other books → inspect citations → jump back to source → save insight → turn it into an action.**

That flow should feel exceptional before the rest of the application is expanded.

---

# Final product thesis

Marginalia is not an ebook reader with a chatbot attached.

It is not a generic RAG interface.

It is not simply a note-taking system.

It is:

> **A personal library where books remain the source of truth, reading stays immersive, AI understands exactly what you're reading, and broader questions can connect evidence across your entire library to produce grounded understanding and practical action.**

The frontend should optimize for four things above everything else:

**Read deeply.**

**Ask naturally.**

**See the evidence.**

**Connect ideas and act on them.**