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
import { getBook, highlights, notes } from "@/lib/library-data";

export const Route = createFileRoute("/book/$bookId")({
  loader: ({ params }) => {
    const book = getBook(params.bookId);
    if (!book) throw notFound();
    return { book };
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
    const description = book.description.slice(0, 155);
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
  const { book } = Route.useLoaderData();
  const [tab, setTab] = useState("Chapters");
  const [ask, setAsk] = useState(false);

  const bookHighlights = highlights.filter((h) => h.bookId === book.id);
  const bookNotes = notes.filter((n) => n.bookId === book.id);
  const currentIndex = Math.floor(book.progress * book.chapters.length);

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
              {book.author} · {book.year} · {book.pages} pages
            </p>
            <div className="mt-5 max-w-sm">
              <ProgressBar value={book.progress} />
              <p className="mt-1.5 text-xs text-faint">
                {Math.round(book.progress * 100)}% · {book.chapter}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/read/$bookId" params={{ bookId: book.id }}>
                <Button variant="primary">Resume reading</Button>
              </Link>
              <Link to="/audio">
                <Button>Listen</Button>
              </Link>
              <Button onClick={() => setAsk(true)}>Ask about this book</Button>
              <Button variant="tertiary">Save</Button>
            </div>
            <p className="mt-7 max-w-[60ch] font-serif text-[1.0625rem] leading-[1.6] text-foreground">
              {book.description}
            </p>
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
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {book.chapters.map((c, i) => (
                  <li key={c.id}>
                    <Link
                      to="/read/$bookId"
                      params={{ bookId: book.id }}
                      className="flex items-baseline gap-4 py-3.5 transition-colors hover:text-accent"
                    >
                      <span className="w-6 shrink-0 font-mono text-2xs text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 font-serif text-base text-foreground">
                        {c.title}
                      </span>
                      <span className="shrink-0 text-xs text-faint">
                        {Math.round(c.words / 220)} min ·{" "}
                        {i < currentIndex
                          ? "Read"
                          : i === currentIndex
                            ? "Reading"
                            : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
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
