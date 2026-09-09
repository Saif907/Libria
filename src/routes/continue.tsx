import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  BookCover,
  Button,
  EmptyState,
  Page,
  PageHeader,
  ProgressBar,
} from "@/components/app/primitives";
import { getLibrary, type LibraryBook } from "@/lib/books";
import {
  lastOpenedLabel,
  progressFraction,
  useAllProgress,
  type ReadingProgress,
} from "@/lib/reading-progress";

export const Route = createFileRoute("/continue")({
  loader: () => getLibrary(),
  head: () => ({
    meta: [
      { title: "Continue Reading — Marginalia" },
      {
        name: "description",
        content: "Pick up where you left off in every book you have open.",
      },
      { property: "og:title", content: "Continue Reading — Marginalia" },
      {
        property: "og:description",
        content: "Resume any book at the exact position you stopped.",
      },
    ],
  }),
  component: ContinuePage,
});

function ContinuePage() {
  const books = Route.useLoaderData();
  const { progress, hydrated } = useAllProgress();

  const rows = useMemo(() => {
    const found: { book: LibraryBook; entry: ReadingProgress }[] = [];
    for (const book of books) {
      const entry = progress[book.id];
      if (entry) found.push({ book, entry });
    }
    return found.sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);
  }, [books, progress]);

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Continue Reading"
          meta={
            hydrated && rows.length
              ? `${rows.length} ${rows.length === 1 ? "book" : "books"} open on this device`
              : "Pick up where you left off"
          }
        />

        {/* Positions are stored in this browser, so there is nothing to show
            until the client has read them. */}
        {!hydrated ? (
          <p className="border-t border-border-subtle py-10 text-sm text-muted-foreground">
            Checking this browser for saved positions…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            line="Nothing open yet"
            explanation="Open any book and this page will remember the chapter you stopped at. Positions are kept in this browser."
            action={
              <Link to="/">
                <Button variant="primary">Browse library</Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-hairline border-t border-border-subtle">
            {rows.map(({ book, entry }) => {
              const fraction = progressFraction(entry);
              return (
                <li key={book.id} className="flex items-center gap-5 py-5">
                  <Link to="/book/$bookId" params={{ bookId: book.id }}>
                    <BookCover book={book} width={56} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/book/$bookId"
                      params={{ bookId: book.id }}
                      className="font-serif text-lg font-semibold text-foreground hover:text-accent"
                    >
                      {book.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Chapter {entry.chapterIndex + 1} of {entry.totalChapters}
                    </p>
                    <div className="mt-2.5 max-w-sm">
                      <ProgressBar value={fraction} />
                      <p className="text-metadata mt-1.5">
                        {Math.round(fraction * 100)}% · last opened{" "}
                        {lastOpenedLabel(entry)}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/read/$bookId"
                    params={{ bookId: book.id }}
                    search={{ chapter: entry.chapterIndex }}
                  >
                    <Button variant="primary">Resume</Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Page>
    </AppShell>
  );
}
