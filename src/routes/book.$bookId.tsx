import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { AskPanel } from "@/components/app/AskPanel";
import {
  BookCover,
  Button,
  EmptyState,
  Page,
  ProgressBar,
  SectionTitle,
  TabBar,
} from "@/components/app/primitives";
import {
  WORDS_PER_MINUTE,
  formatMinutes,
  getBookDetail,
  hasMarkdown,
  hasPdf,
} from "@/lib/books";
import { highlights, notes } from "@/lib/library-data";
import { lastOpenedLabel, useProgress } from "@/lib/reading-progress";

export const Route = createFileRoute("/book/$bookId")({
  staleTime: 60_000,
  gcTime: 15 * 60_000,
  loader: async ({ params }) => {
    const detail = await getBookDetail({ data: { bookId: params.bookId } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Book unavailable — Marginalia" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { book } = loaderData;
    const title = `${book.title} — Marginalia`;
    const description = (
      book.description || `${book.title} by ${book.author}, in your library.`
    ).slice(0, 155);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "book" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: BookDetail,
});

function BookDetail() {
  const { book, chapters, totalWords } = Route.useLoaderData();
  const { progress, fraction } = useProgress(book.id);
  const [tab, setTab] = useState("Chapters");
  const [ask, setAsk] = useState(false);

  const bookHighlights = highlights.filter((h) => h.bookId === book.id);
  const bookNotes = notes.filter((n) => n.bookId === book.id);

  // A PDF-only book has no parsed chapters, so everything chapter-shaped —
  // progress, resume position, reading time — has nothing to stand on.
  const readable = hasMarkdown(book) && chapters.length > 0;

  // Where to resume, and how far each chapter counts as read.
  const currentIndex =
    readable && progress ? Math.min(progress.chapterIndex, chapters.length - 1) : 0;
  const currentChapter = chapters[currentIndex];

  const meta = [
    book.author,
    book.year > 0 ? String(book.year) : null,
    readable ? `${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}` : null,
    readable ? `${formatMinutes(totalWords / WORDS_PER_MINUTE)} read` : null,
    // Worth stating plainly: it explains why there is no reading time.
    readable ? null : "PDF only",
  ].filter(Boolean);

  return (
    <AppShell>
      <Page>
        <div className="flex flex-col gap-7 sm:flex-row sm:gap-9">
          <BookCover book={book} width={148} />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl font-semibold leading-[1.15] tracking-[-0.015em] text-foreground">
              {book.title}
            </h1>
            <p className="mt-1.5 text-base text-muted-foreground">
              {meta.join(" · ")}
            </p>
            {readable ? (
              <div className="mt-5 max-w-sm">
                <ProgressBar value={fraction} />
                <p className="mt-1.5 text-xs text-faint">
                  {progress
                    ? `${Math.round(fraction * 100)}% · ${currentChapter?.title ?? ""} · opened ${lastOpenedLabel(progress)}`
                    : "Not opened yet"}
                </p>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              {/* Whichever formats exist, offered in reading order. The PDF is
                  primary only when there is no text version to prefer. */}
              {readable ? (
                <Link
                  to="/read/$bookId"
                  params={{ bookId: book.id }}
                  search={{ chapter: currentIndex }}
                >
                  <Button variant="primary">
                    {progress ? "Resume reading" : "Start reading"}
                  </Button>
                </Link>
              ) : null}
              {hasPdf(book) ? (
                <Link to="/pdf/$bookId" params={{ bookId: book.id }}>
                  <Button variant={readable ? "secondary" : "primary"}>
                    {readable ? "View PDF" : "Open PDF"}
                  </Button>
                </Link>
              ) : null}
              <Link to="/audio">
                <Button>Listen</Button>
              </Link>
              <Button onClick={() => setAsk(true)}>Ask about this book</Button>
              <Button variant="tertiary">Save</Button>
            </div>
            {book.description ? (
              <p className="mt-7 max-w-[60ch] font-serif text-[1.0625rem] leading-[1.6] text-foreground">
                {book.description}
              </p>
            ) : null}
            {book.categories.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {book.categories.map((c) => (
                  <Link
                    key={c}
                    to="/"
                    search={{ collection: book.collection }}
                    className="rounded-xs border border-border px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    {c.replace(/_/g, " ")}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-12">
          <TabBar
            tabs={["Chapters", "Highlights", "Notes"]}
            active={tab}
            onChange={setTab}
          />

          <div className="mt-6">
            {tab === "Chapters" ? (
              readable ? (
                <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                  {chapters.map((c, i) => (
                    <li key={c.id}>
                      <Link
                        to="/read/$bookId"
                        params={{ bookId: book.id }}
                        search={{ chapter: i }}
                        className="flex items-baseline gap-4 py-3.5 transition-colors hover:text-accent"
                      >
                        <span className="w-6 shrink-0 font-mono text-2xs text-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 font-serif text-base text-foreground">
                          {c.title}
                        </span>
                        <span className="shrink-0 text-xs text-faint">
                          {formatMinutes(c.words / WORDS_PER_MINUTE)}
                          {progress
                            ? ` · ${
                                i < currentIndex
                                  ? "Read"
                                  : i === currentIndex
                                    ? "Reading"
                                    : "—"
                              }`
                            : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  line="No chapter list for this one"
                  explanation="Chapters come from the converted text, and this book exists only as a PDF. The PDF viewer has its own page navigation and search."
                  {...(hasPdf(book)
                    ? {
                        action: (
                          <Link to="/pdf/$bookId" params={{ bookId: book.id }}>
                            <Button variant="primary">Open PDF</Button>
                          </Link>
                        ),
                      }
                    : {})}
                />
              )
            ) : null}

            {tab === "Highlights" ? (
              bookHighlights.length ? (
                <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                  {bookHighlights.map((h) => (
                    <li key={h.id} className="py-4">
                      <p className="border-l-2 border-highlight pl-3 font-serif text-base leading-[1.55] text-foreground">
                        {h.text}
                      </p>
                      {h.note ? (
                        <p className="mt-2 pl-3 text-sm text-muted-foreground">
                          {h.note}
                        </p>
                      ) : null}
                      <p className="mt-2 pl-3 text-xs text-faint">
                        {h.chapter} · {h.date}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  line="No highlights in this book yet"
                  explanation="Select any passage while reading to keep it here."
                />
              )
            ) : null}

            {tab === "Notes" ? (
              bookNotes.length ? (
                <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                  {bookNotes.map((n) => (
                    <li key={n.id} className="py-4">
                      <p className="text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-1.5 max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                        {n.body}
                      </p>
                      <p className="mt-2 text-xs text-faint">
                        {n.chapter} · {n.updated}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  line="No notes yet"
                  explanation="Your own thinking about this book will collect here."
                />
              )
            ) : null}
          </div>
        </div>

        <div className="mt-12">
          <SectionTitle>Recent questions about this book</SectionTitle>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {[
              "What is the author's central argument?",
              "What should I actually apply from this book?",
              "Where is this book weakest?",
            ].map((q) => (
              <li key={q}>
                <button
                  onClick={() => setAsk(true)}
                  className="w-full py-3 text-left text-sm text-foreground transition-colors hover:text-accent"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Page>

      <AskPanel
        open={ask}
        onClose={() => setAsk(false)}
        contextDetail={`${book.title} · ${book.author}`}
        initialScope="book"
      />
    </AppShell>
  );
}
