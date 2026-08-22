import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, List as ListIcon, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  BookCover,
  Button,
  IconButton,
  Page,
  PageHeader,
  ProgressBar,
  SectionTitle,
} from "@/components/app/primitives";
import { books, continueReading, type Book } from "@/lib/library-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    collection: typeof s.collection === "string" ? s.collection : undefined,
  }),
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
  component: LibraryPage,
});

function LibraryPage() {
  const { collection } = Route.useSearch();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");

  const filtered = books.filter((b) => {
    const matchesCollection = !collection || b.collection === collection;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q);
    return matchesCollection && matchesQuery;
  });

  return (
    <AppShell>
      <Page>
        <PageHeader
          title={collection ? collection : "Library"}
          meta={`${books.length} books · ${continueReading.length} currently reading`}
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

        {!collection && (
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
              {continueReading.slice(0, 3).map((b) => (
                <li key={b.id}>
                  <Link
                    to="/read/$bookId"
                    params={{ bookId: b.id }}
                    className="group flex gap-4"
                  >
                    <BookCover book={b} width={64} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate font-serif text-base font-semibold text-foreground group-hover:text-accent">
                        {b.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {b.author}
                      </p>
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {b.chapter}
                      </p>
                      <ProgressBar value={b.progress} className="mt-2" />
                      <p className="text-metadata mt-1.5">
                        {Math.round(b.progress * 100)}% · {b.lastOpened}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle
            aside={
              <span className="text-metadata">{filtered.length} books</span>
            }
          >
            {collection ? "Books" : "Your books"}
          </SectionTitle>
          {filtered.length === 0 ? (
            <div className="max-w-md border-t border-border-subtle py-10">
              <p className="text-lg font-medium">Your library is empty.</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Import your first book to begin reading.
              </p>
              <Link to="/import" className="mt-5 inline-block">
                <Button variant="primary">Import book</Button>
              </Link>
            </div>
          ) : view === "grid" ? (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((b) => (
                <li key={b.id}>
                  <GridBook book={b} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-hairline border-t border-border-subtle">
              {filtered.map((b) => (
                <li key={b.id}>
                  <ListBook book={b} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Page>
    </AppShell>
  );
}

function GridBook({ book }: { book: Book }) {
  return (
    <Link to="/book/$bookId" params={{ bookId: book.id }} className="group block">
      <BookCover book={book} width={168} className="w-full" />
      <p className="mt-3 line-clamp-2 font-serif text-sm font-semibold text-foreground group-hover:text-accent">
        {book.title}
      </p>
      <p className="truncate text-sm text-muted-foreground">{book.author}</p>
      {book.progress > 0 && book.progress < 1 ? (
        <ProgressBar value={book.progress} className="mt-2 w-2/3" />
      ) : (
        <p className="text-metadata mt-2">
          {book.progress === 1 ? "Finished" : "Not started"}
        </p>
      )}
    </Link>
  );
}

function ListBook({ book }: { book: Book }) {
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
      <div className="hidden flex-1 sm:block">
        <ProgressBar value={book.progress} />
        <p className="text-metadata mt-1.5">
          {book.progress === 1
            ? "Finished"
            : book.progress === 0
              ? "Not started"
              : `${Math.round(book.progress * 100)}%`}
        </p>
      </div>
      <span className="text-metadata hidden w-28 text-right md:inline">
        {book.lastOpened}
      </span>
    </Link>
  );
}
