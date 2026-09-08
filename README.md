# The Reader's Workbench

You are professional industry standard ui/ux designer with 10+ yrs exp 
You are designing and implementing the frontend for a serious, premium personal reading and knowledge application.

This is NOT a generic AI SaaS dashboard.

This is NOT a ChatGPT wrapper.

This is NOT a social reading app.

This is NOT a productivity dashboard.

The product is a focused digital reading environment for ebooks with:

1. A personal ebook library

2. A high-quality ebook reader

3. A separate global RAG / knowledge assistant

4. A separate context-aware reading assistant

5. Audiobook / text-to-speech playback

6. Highlights, notes, bookmarks and saved insights

7. Cross-book knowledge discovery

8. A future path to selected multi-user accounts

The product should feel like a serious combination of:

- a premium ebook reader

- a research / knowledge workspace

- a thoughtful desktop application

- a quiet editorial product

It should NOT visually advertise “AI”.

The interface should feel so natural that the AI functionality feels like a capability embedded into the product rather than the product being an AI chatbot.

==================================================

CORE DESIGN PHILOSOPHY

==================================================

Primary principle:

THE CONTENT IS THE PRODUCT.

The book should be visually dominant while reading.

The library should feel like a personal collection.

The AI should appear only when useful.

The interface should recede when the user is reading.

Design characteristics:

- editorial

- quiet

- refined

- warm

- intelligent

- precise

- highly readable

- minimal but not sterile

- modern without looking trendy

- premium without looking luxurious

- practical rather than decorative

- information-dense where appropriate

- spacious where reading benefits from it

Avoid anything that makes the UI look AI-generated or template-generated.

==================================================

STRICT ANTI-AI-SLOP RULES

==================================================

DO NOT use:

- purple-blue gradients

- neon gradients

- AI glow effects

- glowing borders

- animated gradient backgrounds

- blobs

- abstract decorative 3D shapes

- glassmorphism everywhere

- frosted glass panels everywhere

- excessive blur

- excessive shadows

- giant rounded cards

- nested cards everywhere

- card inside card inside card

- excessive pills

- excessive badges

- excessive icon circles

- sparkles as an AI symbol

- “✨ AI”

- “Magic”

- “Copilot”

- generic “AI Assistant” hero sections

- oversized marketing-style headlines

- dashboard metric cards for meaningless metrics

- fake productivity scores

- fake knowledge scores

- decorative graphs without useful information

- excessive hover animations

- bouncing components

- parallax

- animated backgrounds

- excessive microanimation

- every element floating

- everything centered

- every section presented as a card

- generic feature grids

- generic SaaS landing-page structure

- excessive empty space with little information

- arbitrary 24px/32px corner radius everywhere

- random type sizes

- too many fonts

- excessive uppercase labels

- text with poor contrast

- tiny gray text

- thin/light fonts for body content

- forced justified book text

- giant navigation icons with labels when simple text works

DO NOT default to:

- Inter everywhere

- Tailwind default component aesthetics

- shadcn defaults without customization

- Material-style cards everywhere

- iOS-style floating rounded containers everywhere

- generic “modern dashboard” templates

Do not make design decisions merely because they are popular in AI-generated interfaces.

Every visual element must have a functional reason to exist.

==================================================

VISUAL LANGUAGE

==================================================

The visual language should combine:

- editorial typography

- restrained application chrome

- warm neutral surfaces

- clear hierarchy

- minimal elevation

- subtle borders

- deliberate spacing

Think:

high-quality digital reading environment

+

research application

+

modern native desktop software

Not:

startup landing page.

==================================================

COLOR SYSTEM

==================================================

Use a warm neutral light theme as the primary theme.

PRIMARY LIGHT BACKGROUND:

#F7F5F0

READING SURFACE:

#FCFBF8

PRIMARY TEXT:

#1B1B18

SECONDARY TEXT:

#6E6C66

TERTIARY TEXT:

#94918A

BORDER:

#DFDCD5

SUBTLE BORDER:

#E9E6DF

HOVER:

#F0EEE8

ACTIVE SURFACE:

#EAE7DF

ACCENT:

#486052

ACCENT DARK:

#35483D

ACCENT LIGHT:

#DDE5DE

ERROR:

#A64B45

WARNING:

#9A6A31

SUCCESS:

#486052

The accent color must be used sparingly.

Use the accent primarily for:

- active navigation

- links

- current reading progress

- primary actions

- selected states

- important controls

- subtle focus states

Do not color entire sections using the accent.

Do not use gradients.

Do not use purple as the brand color.

The neutral palette should carry most of the interface.

==================================================

DARK THEME

==================================================

Provide a proper dark reading theme rather than simply inverting colors.

DARK APP BACKGROUND:

#171716

DARK READING SURFACE:

#1D1C1A

PRIMARY TEXT:

#E9E7E1

SECONDARY TEXT:

#A9A69F

TERTIARY TEXT:

#77746E

BORDER:

#35332F

HOVER:

#252421

ACTIVE:

#2C302C

ACCENT:

#8EA997

Dark mode should be warm and low-fatigue.

Avoid pure black backgrounds.

Avoid pure white text.

==================================================

TYPOGRAPHY

==================================================

Use two primary type roles:

1. UI / navigation / controls

2. Long-form reading content

UI FONT:

Use Geist or a similar refined modern sans-serif.

Fallback:

system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

BOOK FONT:

Use Literata or Source Serif 4.

Fallback:

Georgia, serif

Optional monospace:

Geist Mono or IBM Plex Mono

Only for technical metadata, code, identifiers or debug information.

Do NOT use more than 3 font families.

Typography should be one of the primary identity elements of the product.

==================================================

TYPE SCALE

==================================================

Use a restrained type scale.

12px:

metadata, tiny supporting labels only

14px:

secondary UI text, table metadata, compact controls

16px:

default UI body text

18px:

large UI body / important explanatory text

20px:

small section titles

24px:

page section heading

30px:

major page heading

36px:

rare large title / selected book title

42px+:

only for exceptional editorial moments, not normal dashboard headings

Avoid arbitrary type sizes.

Use font weight instead of adding unnecessary sizes.

Preferred weights:

400 regular

500 medium

600 semibold

700 bold

Avoid 300/light text for anything important.

==================================================

BOOK TYPOGRAPHY

==================================================

The book reader is the most important typography environment in the application.

Default reading size:

19px desktop

Allow:

16px

17px

18px

19px

20px

21px

22px

Default line height:

1.65

Allow user adjustment:

1.45

1.55

1.65

1.75

1.85

Default book measure:

approximately 650px–760px

Never allow the default reading column to span the full desktop viewport.

Maximum readable line length:

roughly 65–80 characters depending on the font.

Do NOT fully justify body text by default.

Keep paragraphs visually distinct through vertical rhythm, not boxes.

Book text should feel like a well-set page.

==================================================

LAYOUT SYSTEM

==================================================

Desktop:

12-column underlying layout, but use it subtly.

Global application shell:

- left navigation rail

- main content area

- optional contextual right panel

Desktop navigation width:

240px–260px

Compact mode:

72px–80px

The app should work at:

1280px

1440px

1600px

1920px

Do not stretch content unnecessarily on large monitors.

Use max-width containers for major content areas.

Mobile:

- no permanent desktop sidebar

- use bottom navigation or top navigation depending on context

- maintain safe-area padding

- minimum interactive target around 44–48px

- preserve reading width and readability

Tablet:

adapt between desktop and mobile rather than simply scaling the desktop UI down.

==================================================

GLOBAL APP SHELL

==================================================

Desktop structure:

--------------------------------------------------

LEFT SIDEBAR

--------------------------------------------------

Top:

Logo / product mark

Primary navigation:

Library

Continue Reading

Saved

Highlights

Notes

Audio

Knowledge

Divider

Collections

- Personal

- Finance

- Psychology

- Work

- Custom collections

Bottom:

Settings

Profile / account

Sidebar rules:

- restrained

- no giant icons

- text-led navigation

- active item indicated by subtle background + accent text

- no heavy filled navigation buttons

- no excessive rounded containers

- no decorative icons unless useful

--------------------------------------------------

MAIN CONTENT

--------------------------------------------------

Use a clean content canvas.

Pages should generally align to a consistent left edge.

Avoid arbitrary centered content blocks.

--------------------------------------------------

OPTIONAL RIGHT CONTEXT PANEL

--------------------------------------------------

Only appear when useful.

Examples:

- reading chat

- book details

- table of contents

- highlights

- audio controls

This panel should feel integrated into the application shell, not like a chatbot popup.

==================================================

PAGE 1 — LIBRARY

==================================================

Purpose:

The user's personal bookshelf.

Header:

Library

Right side:

Search

Import

Sort

View toggle

Under heading:

small metadata such as:

127 books · 3 currently reading

Do not create fake “knowledge metrics”.

--------------------------------------------------

CONTINUE READING

--------------------------------------------------

Horizontal or compact list.

Each item:

- cover

- title

- author

- current chapter

- reading progress

- last opened time

Use subtle progress indicators.

Avoid huge book-card grids.

--------------------------------------------------

YOUR BOOKS

--------------------------------------------------

Allow:

grid

list

Grid:

book cover is primary visual.

Below cover:

title

author

progress

List:

cover

title

author

progress

last opened

No giant card backgrounds.

Books should sit directly on the page surface whenever possible.

--------------------------------------------------

EMPTY STATE

--------------------------------------------------

Do not use:

huge illustration

AI sparkle

generic “No books yet”

Use:

Your library is empty.

Import your first book to begin reading.

[Import book]

==================================================

PAGE 2 — CONTINUE READING

==================================================

Purpose:

Immediate continuation.

Header:

Continue Reading

Primary list sorted by most recently opened.

Each item:

book cover

title

current chapter

progress

last position

resume button

Optional:

“Pick up where you left off”

This page should be extremely simple.

==================================================

PAGE 3 — BOOK DETAIL

==================================================

Layout:

Left:

large book cover

Middle:

Title

Author

Metadata

Description

Progress

Actions:

Continue Reading

Listen

Bookmark

More

Right / lower:

Contents

Notes

Highlights

Saved insights

Do NOT make every section a separate floating card.

Use typography, dividers and spacing to establish hierarchy.

Metadata should be quiet.

==================================================

PAGE 4 — READER

==================================================

THIS IS THE MOST IMPORTANT PAGE.

The reader should use a focused full-screen environment.

Header:

Back to library

Book title

Current chapter

reading progress

minimal menu

The top bar should disappear or become subtle while actively reading.

Main layout:

LEFT:

Table of contents trigger

CENTER:

Book text

RIGHT:

optional reading assistant / annotations panel

Book text centered within a fixed readable measure.

Large vertical breathing room.

Chapter title:

serif

30–36px

medium/semibold

Body:

19px default

1.65 line height

Paragraph spacing:

0.75–1em

No cards around paragraphs.

No unnecessary borders.

No page decorations.

--------------------------------------------------

READER TOOLBAR

--------------------------------------------------

Appear on:

selection

hover

tap

or explicit activation

Controls:

Highlight

Note

Bookmark

Ask

Explain

Simplify

Keep toolbar compact.

Do not use pill soup.

--------------------------------------------------

SELECTION MENU

--------------------------------------------------

When text is selected:

Highlight

Add Note

Explain

Example

Challenge

Ask

Use a compact contextual menu.

Do not make it a large bottom sheet on desktop.

==================================================

PAGE 5 — READING CHAT

==================================================

IMPORTANT:

This is NOT the global RAG assistant.

It is a book-aware contextual reading companion.

Its context priority:

1. selected text

2. surrounding paragraphs

3. current section

4. current chapter

5. current book

Do not search the whole library by default.

Visual style:

quiet side panel

Header:

About this book

Subheading:

Ask about the passage, chapter, argument, or example.

Suggested actions:

Explain

Simplify

Give an example

Challenge this idea

Apply this

Conversation area:

compact and readable

User messages:

minimal visual treatment

AI responses:

text-first

Sources:

small but visible

Example:

Source

The Scout Mindset

Chapter 5

Jump to passage →

Chat should feel like a reading tool rather than a generic chatbot.

Do NOT display a giant AI avatar.

Do NOT use sparkle symbols.

Do NOT call it “AI Assistant”.

==================================================

PAGE 6 — GLOBAL KNOWLEDGE / RAG

==================================================

This is completely separate from Reading Chat.

Purpose:

Search and reason over the user's entire library.

Header:

Ask your library

Subtitle:

Search across your books, notes and saved insights.

Primary input:

large but restrained search field

Examples:

- What do my books say about discipline?

- Compare Atomic Habits and Deep Work.

- Which books discuss risk management?

- What methods for learning are supported by evidence?

- What are the strongest arguments against this idea?

Below:

recent questions

Then answer interface.

--------------------------------------------------

RAG ANSWER

--------------------------------------------------

Answer first.

Then:

Sources

Each source:

Book

Chapter

specific passage

Jump to source

Allow:

Open passage

--------------------------------------------------

CROSS-BOOK SYNTHESIS

--------------------------------------------------

For comparisons, structure answers into:

Common ground

Differences

Contradictions

Practical synthesis

Always show sources.

Never imply agreement where the retrieved sources disagree.

==================================================

PAGE 7 — KNOWLEDGE

==================================================

A personal repository for durable insights.

Tabs:

Insights

Actions

Questions

Highlights

Notes

--------------------------------------------------

INSIGHT

--------------------------------------------------

Each saved insight should contain:

Title

Summary

Source book

Chapter

Original passage

User note

AI interpretation

Tags

Example:

Better environments beat relying on motivation

Source:

Atomic Habits · Chapter 6

Use subtle source links.

Do not create a giant card.

--------------------------------------------------

ACTIONS

--------------------------------------------------

Actions should be practical.

Structure:

Action

Why

Source

Status

Statuses:

Not started

In progress

Done

This should be a useful personal system, not a gamified productivity dashboard.

Do NOT add XP, streaks, scores, coins, badges or “knowledge levels”.

==================================================

PAGE 8 — AUDIOBOOK / AUDIO PLAYER

==================================================

Audiobook experience is integrated with reading.

Player:

chapter title

progress

current time

duration

Controls:

15 sec back

play/pause

30 sec forward

speed

bookmark

sleep timer

Speed:

0.8x

1x

1.1x

1.25x

1.5x

1.75x

2x

Audio playback should sync with reading position.

Current sentence or paragraph should be subtly highlighted.

Do NOT make the interface resemble Spotify.

Reading remains primary.

--------------------------------------------------

MINI PLAYER

--------------------------------------------------

When navigating elsewhere:

bottom mini-player

Book title

chapter

progress

play/pause

No huge floating rounded player.

==================================================

PAGE 9 — HIGHLIGHTS

==================================================

Purpose:

Review things the user saved from books.

Organize by:

recent

book

tag

Each highlight:

highlighted text

book

chapter

optional note

Click:

jump back to exact source.

Do not bury source location.

==================================================

PAGE 10 — NOTES

==================================================

User notes are separate from highlights.

Allow:

freeform notes

source-linked notes

book-linked notes

A note can reference:

book

chapter

passage

Make note editing feel like a writing environment.

==================================================

PAGE 11 — SEARCH

==================================================

Global search should search:

Books

Authors

Text

Highlights

Notes

Insights

Questions

Search results should be source-oriented.

Example:

The Scout Mindset

Chapter 5

“...”

Highlight

...

Insight

...

Avoid generic search-result cards.

==================================================

PAGE 12 — SETTINGS

==================================================

Sections:

Appearance

Reading

Audio

AI

Library

Keyboard Shortcuts

Account

Privacy

--------------------------------------------------

APPEARANCE

--------------------------------------------------

Theme:

Light

Dark

System

Accent color:

default

optional alternatives

Density:

Comfortable

Compact

Animations:

Full

Reduced

Off

--------------------------------------------------

READING

--------------------------------------------------

Font family

Font size

Line height

Column width

Margins

Theme

Page mode / continuous mode

--------------------------------------------------

AUDIO

--------------------------------------------------

Default voice

Playback speed

Auto-play next chapter

Audio download/cache

--------------------------------------------------

AI

--------------------------------------------------

Model

Response style

Citation behavior

RAG scope

Context window settings

DO NOT expose unnecessary technical AI settings to normal users.

==================================================

PAGE 13 — IMPORT

==================================================

Import experience should support:

EPUB

PDF

Drag & drop.

Show:

book title

author

cover

detected chapters

Import progress.

After import:

Book successfully added.

[Start Reading]

No giant illustration.

==================================================

PAGE 14 — ONBOARDING

==================================================

Keep onboarding minimal.

Screen 1:

Welcome to your library.

Screen 2:

Import a book.

Screen 3:

Choose reading preferences.

Done.

No:

multi-page marketing onboarding

feature carousel

AI promises

fake productivity claims

==================================================

BOOK READER MICROINTERACTIONS

==================================================

Selection:

quick, subtle response

Highlight:

brief background transition

Bookmark:

small confirmation

AI panel:

slide/fade 150–200ms

Audio:

smooth progress

Do not animate everything.

Motion should communicate state, not decorate the interface.

Use:

ease-out

150–220ms

no bounce

Support reduced motion.

==================================================

BUTTON DESIGN

==================================================

Use three levels:

PRIMARY:

filled accent background

dark/light accessible text

SECONDARY:

neutral surface / subtle border

TERTIARY:

text / icon action

Do NOT turn every action into a filled button.

Primary button only for:

Continue Reading

Import

Save

other truly primary actions

Use compact controls for reader utilities.

==================================================

INPUT DESIGN

==================================================

Inputs:

simple

quiet

clear border

strong focus state

Do not use floating labels.

Placeholder text should never replace labels where a label is needed.

Search field can be visually larger than standard inputs.

Chat input:

integrated into the assistant surface.

==================================================

CARDS AND SURFACES

==================================================

Use surfaces sparingly.

Hierarchy:

Level 0:

page background

Level 1:

content surface / reading surface

Level 2:

floating panel / dialog

No shadow gymnastics.

Prefer:

border

background difference

spacing

Cards are appropriate for:

book covers when visual containment is necessary

floating panels

temporary content groups

Do not use cards for:

every paragraph

every navigation item

every metric

every list item

==================================================

DIVIDERS

==================================================

Use thin, subtle dividers.

Prefer spacing when possible.

Do not divide every section with a line.

==================================================

BOOK COVERS

==================================================

Book covers are important visual anchors.

Use:

4px–6px radius

subtle shadow only when floating

natural aspect ratio

Do not put book covers inside excessive containers.

==================================================

ICONOGRAPHY

==================================================

Use one icon family.

Lucide or equivalent is acceptable.

Icons should be:

simple

monoline

small

consistent

Typical size:

16px

18px

20px

24px

Do not put an icon next to every heading.

Do not put icons in colored circles by default.

==================================================

ACCESSIBILITY

==================================================

Minimum normal text contrast:

4.5:1

Large text:

3:1 minimum

Prefer stronger contrast for long-form reading.

Keyboard:

every major action accessible

Focus state:

obvious, tasteful, non-glowing

Touch targets:

approximately 44–48px minimum

Text should remain readable at 200% zoom.

Do not make information dependent on color alone.

Support:

light mode

dark mode

reduced motion

font scaling

keyboard navigation

==================================================

RESPONSIVE BEHAVIOR

==================================================

DESKTOP:

sidebar + content + optional contextual panel

TABLET:

sidebar can collapse

reading width preserved

MOBILE:

single-column reading

bottom navigation where appropriate

contextual tools as bottom sheets only when necessary

audio mini-player above bottom navigation

Do not merely shrink desktop layouts.

Reading on mobile should feel intentionally designed.

==================================================

MOBILE READER

==================================================

Full-width reading surface.

Top:

back

chapter

menu

Text:

17–19px

1.55–1.75 line height

Margins:

18–24px

Bottom:

minimal reader controls

Tap center:

toggle chrome

Tap selected text:

selection tools

Reading experience should be calm and distraction-free.

==================================================

DESKTOP READER

==================================================

Default:

book text centered

Optional left:

table of contents

Optional right:

reading assistant

Reading area should remain visually dominant.

When user does not interact:

side panels may fade or collapse.

==================================================

TABLE OF CONTENTS

==================================================

Use chapter list.

Current chapter highlighted subtly.

Show progress optionally.

Do not create giant nested accordion cards.

Simple text hierarchy.

==================================================

DATA-DENSE SCREENS

==================================================

For:

library search

notes

knowledge

settings

Prefer:

rows

lists

tabs

dividers

inline metadata

instead of:

card grids

==================================================

AI RESPONSE DESIGN

==================================================

AI responses should use normal typography.

No:

oversized “AI” heading

gradient text

sparkle icon

neon border

robot avatar

Answers should be:

clear

structured

source-linked

readable

When citations exist:

Source

Book title · Chapter

[Jump to passage]

Use citations naturally.

==================================================

RAG SOURCE HANDLING

==================================================

Every retrieved source should preserve:

book_id

chapter_id

section_id

paragraph_id

text position

The UI must support:

Jump to source

When the user clicks the source:

open the book

navigate to the exact passage

highlight the relevant text

This behavior is essential.

==================================================

READING CHAT SOURCE PRIORITY

==================================================

For Reading Chat:

Priority:

selected text

→ nearby context

→ current section

→ current chapter

→ current book

Do not search all books automatically.

==================================================

GLOBAL RAG SOURCE PRIORITY

==================================================

For Global Knowledge:

entire personal library

with:

semantic retrieval

metadata filtering

book/chapter references

saved notes

saved insights

Allow cross-book synthesis.

==================================================

EVIDENCE-AWARE DESIGN

==================================================

The knowledge system should distinguish:

Author claim

Research cited by author

User interpretation

AI interpretation

Action derived from idea

External evidence if enabled

The UI should never imply that an author's statement is automatically scientifically proven.

For an evidence-oriented response, allow:

Claim

Evidence

Caveat

Practical implication

Sources

This should be visually understated rather than presented as colorful “confidence cards”.

==================================================

EMPTY STATES

==================================================

Empty states must be simple and human.

Avoid:

large illustrations

AI mascots

gradients

marketing slogans

Use:

one sentence

one explanation

one action

Example:

No highlights yet.

Save passages while reading and they’ll appear here.

[Start Reading]

==================================================

ERROR STATES

==================================================

Use inline errors where possible.

Be precise:

“Unable to load chapter.”

not:

“Oops! Something magical went wrong ✨”

==================================================

LOADING STATES

==================================================

Use restrained skeletons only when genuinely useful.

For reading text:

prefer immediate structural content where possible.

Do not animate giant placeholder cards.

==================================================

TOASTS

==================================================

Use small, quiet bottom notifications.

Examples:

Highlight saved

Bookmark added

Note saved

Audio downloaded

Do not use modal dialogs for minor confirmations.

==================================================

DESIGN SYSTEM TOKENS

==================================================

Define all design values centrally.

Create tokens for:

colors

font families

font sizes

line heights

font weights

spacing

border radii

border colors

shadows

transitions

breakpoints

content widths

Do not hardcode random values throughout components.

==================================================

DESIGN SYSTEM RADIUS

==================================================

Use restrained radius values:

0px

4px

6px

8px

10px

Do not default everything to 16px / 20px / 24px.

==================================================

SHADOW SYSTEM

==================================================

Default:

none

Small floating surface:

very subtle shadow

Modal:

slightly stronger but still restrained

Avoid huge soft shadows.

==================================================

SPACING SYSTEM

==================================================

Use a consistent base spacing system.

Preferred:

4

8

12

16

24

32

40

48

64

80

Reading layout may use larger values.

==================================================

CONTENT WIDTHS

==================================================

General page:

max 1200px–1280px

Reading content:

650–760px

Long-form explanation:

680–820px

Knowledge answer:

720–900px

Do not create overly wide text columns.

==================================================

HEADER DESIGN

==================================================

Headers should be compact.

Avoid giant hero sections.

Library:

simple title + actions

Knowledge:

title + search

Reader:

minimal contextual header

Book detail:

title hierarchy

==================================================

NAVIGATION

==================================================

Navigation should be predictable.

Desktop:

sidebar

Mobile:

bottom navigation or contextual top navigation

Do not put five levels of nested navigation into the sidebar.

Primary navigation should be:

Library

Continue

Knowledge

Saved

Secondary:

Collections

Settings

==================================================

NO MARKETING-LANDING-PAGE VISUALS INSIDE THE APP

==================================================

This is an application.

Do not create:

hero sections

marketing slogans

feature cards

“powered by AI” banners

gradient callouts

testimonial-style blocks

fake stats

The app should immediately get users to their books.

==================================================

BOOK-FIRST VISUAL PRIORITY

==================================================

When the user is reading:

Priority 1:

book text

Priority 2:

reading position

Priority 3:

book navigation

Priority 4:

annotation

Priority 5:

audio

Priority 6:

AI

The AI must never visually overpower the book.

==================================================

INTERACTION PRINCIPLES

==================================================

Every action should be discoverable without being visually loud.

Prefer:

contextual controls

progressive disclosure

direct manipulation

keyboard shortcuts

text labels where ambiguity exists

Avoid:

floating action buttons everywhere

permanent toolbars

permanent AI chat widgets

==================================================

KEYBOARD SHORTCUTS

==================================================

For desktop reader:

Space:

play / pause audio

J:

previous short interval

L:

next short interval

N:

next chapter

P:

previous chapter

H:

highlight selected text

B:

bookmark

A:

open reading chat

Esc:

close panel

Cmd/Ctrl + K:

global search

Do not show all shortcuts constantly.

Provide a keyboard shortcut help screen.

==================================================

READER FOCUS MODE

==================================================

Provide a focus mode that removes:

sidebar

extra metadata

optional panels

Keep:

book text

minimal progress

audio controls when active

Focus mode should feel calm and nearly fullscreen.

==================================================

AUDIO / TEXT SYNC

==================================================

Reader and audiobook use shared paragraph / sentence identifiers.

When narration reaches a sentence:

subtle highlight

When user taps a sentence:

audio seeks to it

When user changes chapter:

audio follows

Save:

book_id

chapter_id

sentence_id

audio_time

==================================================

PERFORMANCE

==================================================

Prioritize:

fast initial render

fast reader opening

progressive loading

lazy loading of covers

audio prefetching

efficient virtualized lists where necessary

The reader should feel faster than the rest of the app.

Avoid unnecessary client-side computation.

==================================================

TECHNICAL FRONTEND PRINCIPLES

==================================================

Build reusable primitives:

AppShell

Sidebar

TopBar

Button

IconButton

Input

SearchInput

Tabs

List

ListRow

BookCover

Progress

Reader

ReaderToolbar

SelectionMenu

BookTOC

ReadingChat

AudioPlayer

MiniPlayer

Highlight

NoteEditor

SourceReference

Citation

Toast

Dialog

SettingsRow

Do not create visually inconsistent one-off components.

==================================================

VISUAL QUALITY CONTROL

==================================================

Before considering a page complete, inspect it specifically for:

1. Too many rounded rectangles

2. Too many cards

3. Too many icons

4. Excessive shadows

5. Excessive accent color

6. Arbitrary spacing

7. Too many font sizes

8. Weak text contrast

9. Large empty spaces with little purpose

10. UI competing with content

11. Generic AI-looking styling

12. Poor mobile reading experience

13. Overly dense controls

14. Unnecessary animations

15. Unclear hierarchy

If any of these occur, simplify.

==================================================

FINAL ART DIRECTION

==================================================

The finished application should feel like:

“Someone cared deeply about reading.”

It should not feel like:

“An AI generated a dashboard and added a book reader.”

The emotional qualities should be:

calm

focused

trustworthy

intelligent

quietly premium

comfortable

serious

human

When uncertain between:

more decoration

and more clarity

ALWAYS choose clarity.

When uncertain between:

more UI

and less UI

ALWAYS choose less UI, provided the feature remains discoverable.

When uncertain between:

flashier AI behavior

and natural interaction

ALWAYS choose natural interaction.

The application should look excellent even if every AI feature were temporarily disabled.

AI is an enhancement layer, not the visual identity.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0d753900-716d-4b3d-b460-adcbd3d55a03).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
