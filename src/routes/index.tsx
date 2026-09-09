import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LayoutGrid, List as ListIcon, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  BookCover,
  Button,
  EmptyState,
  IconButton,
  Page,
  PageHeader,
  ProgressBar,
  SectionTitle,
} from "@/components/app/primitives";
import {
  collectionLabels,
  formatMinutes,
  getLibrary,
  hasPdf,
  type LibraryBook,
} from "@/lib/books";
import {
  lastOpenedLabel,
  progressFraction,
  useAllProgress,
  type ProgressMap,
  type ReadingProgress,
} from "@/lib/reading-progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { collection?: string } =>
    typeof s["collection"] === "string"
      ? { collection: s["collection"] }
      : {},
  loader: () => getLibrary(),
  head: () => ({
    meta: [
      { title: "Library — Marginalia" },
      {
        name: "description",
        content:
          "Your personal ebook library: continue reading, browse your collection, and return to the passages you saved.",
      },
      { property: "og:title", content: "Library — Marginalia" },
      {
        property: "og:description",
        content: "A quiet reading environment for your personal ebook library.",
      },
    ],
  }),
  errorComponent: LibraryError,
  component: LibraryPage,
});

/**
 * The library cannot render without the bucket, and a misconfigured credential
 * is the likeliest cause — so show what actually failed instead of the root
 * boundary's generic message.
 */
function LibraryError({ error }: { error: Error }) {
  return (
    <AppShell>
      <Page>
        <PageHeader title="Library" meta="Could not reach your books" />
        <div className="max-w-xl border-t border-border-subtle py-10">
          <p className="text-lg font-medium text-foreground">
            Your library could not be loaded.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The book files live in Cloud Storage, and the server could not read
            them.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-sm border border-border bg-surface p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {error.message}
          </pre>
        </div>
      </Page>
    </AppShell>
  );
}

function LibraryPage() {
  const books = Route.useLoaderData();
  const { collection } = Route.useSearch();
  const { progress } = useAllProgress();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");

  const reading = useMemo(() => inProgress(books, progress), [books, progress]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((book) => {
      const matchesCollection =
        !collection || collectionLabels(book).includes(collection);
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q);
      return matchesCollection && matchesQuery;
    });
  }, [books, collection, query]);

  return (
    <AppShell>
      <Page>
        <PageHeader
          title={collection ? collection : "Library"}
          meta={`${books.length} ${books.length === 1 ? "book" : "books"}${
            reading.length ? ` · ${reading.length} currently reading` : ""
          }`}
          actions={
            <>
              <div className="relative hidden sm:block">
                <Search
                  size={15}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search library"
                  aria-label="Search library"
                  className="h-9 w-56 rounded-sm border border-border bg-reading pr-2.5 pl-8 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
                />
              </div>
              <Link to="/import">
                <Button variant="primary">
                  <Plus size={15} strokeWidth={2} />
                  Import
                </Button>
              </Link>
              <div className="flex overflow-hidden rounded-sm border border-border">
                <IconButton
                  label="Grid view"
                  onClick={() => setView("grid")}
                  className={cn("h-8 w-8 rounded-none", view === "grid" && "bg-active text-foreground")}
                >
                  <LayoutGrid size={15} strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label="List view"
                  onClick={() => setView("list")}
                  className={cn("h-8 w-8 rounded-none", view === "list" && "bg-active text-foreground")}
                >
                  <ListIcon size={15} strokeWidth={1.75} />
                </IconButton>
              </div>
            </>
          }
        />

        {/* Reading positions live in this browser, so this section appears
            after hydration rather than during SSR. */}
        {!collection && reading.length > 0 ? (
          <section className="mb-12">
            <SectionTitle
              aside={
                <Link
                  to="/continue"
                  className="text-sm text-muted-foreground transition-colors hover:text-accent"
                >
                  All
                </Link>
              }
            >
              Continue reading
            </SectionTitle>
            <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              {reading.slice(0, 3).map(({ book, entry }) => (
                <li key={book.id}>
                  <Link
                    to="/read/$bookId"
                    params={{ bookId: book.id }}
                    search={{ chapter: entry.chapterIndex }}
                    className="group flex gap-4"
                  >
                    <BookCover book={book} width={64} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate font-serif text-base font-semibold text-foreground group-hover:text-accent">
                        {book.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {book.author}
                      </p>
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        Chapter {entry.chapterIndex + 1} of {entry.totalChapters}
                      </p>
                      <ProgressBar
                        value={progressFraction(entry)}
                        className="mt-2"
                      />
                      <p className="text-metadata mt-1.5">
                        {Math.round(progressFraction(entry) * 100)}% ·{" "}
                        {lastOpenedLabel(entry)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <SectionTitle
            aside={
              <span className="text-metadata">
                {filtered.length} {filtered.length === 1 ? "book" : "books"}
              </span>
            }
          >
            {collection ? "Books" : "Your books"}
          </SectionTitle>
          {books.length === 0 ? (
            <EmptyState
              line="Your library is empty."
              explanation="Import your first book to begin reading."
              action={
                <Link to="/import">
                  <Button variant="primary">Import book</Button>
                </Link>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              line="Nothing matches that."
              explanation={
                collection
                  ? "No book in this collection matches your search."
                  : "Try a shorter search, or a different spelling."
              }
              {...(collection
                ? {
                    action: (
                      <Link to="/" search={{}}>
                        <Button>Show all books</Button>
                      </Link>
                    ),
                  }
                : {})}
            />
          ) : view === "grid" ? (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((book) => (
                <li key={book.id}>
                  <GridBook book={book} progress={progress[book.id]} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-hairline border-t border-border-subtle">
              {filtered.map((book) => (
                <li key={book.id}>
                  <ListBook book={book} progress={progress[book.id]} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Page>
    </AppShell>
  );
}

type ReadingRow = { book: LibraryBook; entry: ReadingProgress };

/** Books with a stored position, most recently opened first. */
function inProgress(books: LibraryBook[], progress: ProgressMap): ReadingRow[] {
  const rows: ReadingRow[] = [];
  for (const book of books) {
    const entry = progress[book.id];
    if (entry) rows.push({ book, entry });
  }
  return rows.sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);
}

/**
 * What an unread book shows where progress would otherwise go. A PDF-only book
 * has no word count behind it, so it names its format instead of displaying a
 * reading time invented from the file size.
 */
function unreadLabel(book: LibraryBook): string {
  if (book.estimatedMinutes > 0) return formatMinutes(book.estimatedMinutes);
  return hasPdf(book) ? "PDF" : "—";
}

/** Marks books whose original PDF is available alongside the text. */
function PdfTag() {
  return (
    <span className="rounded-xs border border-border px-1 py-px text-2xs text-faint">
      PDF
    </span>
  );
}

function GridBook({
  book,
  progress,
}: {
  book: LibraryBook;
  progress: ReadingProgress | undefined;
}) {
  const fraction = progressFraction(progress);
  return (
    <Link to="/book/$bookId" params={{ bookId: book.id }} className="group block">
      <BookCover book={book} width={168} className="w-full" />
      <p className="mt-3 line-clamp-2 font-serif text-sm font-semibold text-foreground group-hover:text-accent">
        {book.title}
      </p>
      <p className="truncate text-sm text-muted-foreground">{book.author}</p>
      {fraction > 0 && fraction < 1 ? (
        <ProgressBar value={fraction} className="mt-2 w-2/3" />
      ) : (
        <p className="text-metadata mt-2">
          {fraction === 1 ? "Finished" : unreadLabel(book)}
        </p>
      )}
    </Link>
  );
}

function ListBook({
  book,
  progress,
}: {
  book: LibraryBook;
  progress: ReadingProgress | undefined;
}) {
  const fraction = progressFraction(progress);
  return (
    <Link
      to="/book/$bookId"
      params={{ bookId: book.id }}
      className="group flex items-center gap-4 py-3 transition-colors hover:bg-hover"
    >
      <BookCover book={book} width={36} float={false} />
      <div className="min-w-0 flex-[2]">
        <p className="truncate font-serif text-base font-semibold text-foreground group-hover:text-accent">
          {book.title}
        </p>
        <p className="truncate text-sm text-muted-foreground">{book.author}</p>
      </div>
      <span className="text-metadata hidden flex-1 items-center gap-2 truncate sm:flex">
        <span className="truncate">{book.collection}</span>
        {hasPdf(book) ? <PdfTag /> : null}
      </span>
      <div className="hidden flex-1 md:block">
        <ProgressBar value={fraction} />
        <p className="text-metadata mt-1.5">
          {fraction === 1
            ? "Finished"
            : fraction === 0
              ? unreadLabel(book)
              : `${Math.round(fraction * 100)}%`}
        </p>
      </div>
      <span className="text-metadata hidden w-28 text-right lg:inline">
        {progress ? lastOpenedLabel(progress) : "—"}
      </span>
    </Link>
  );
}
