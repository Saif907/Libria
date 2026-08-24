import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  Page,
  PageHeader,
  SearchInput,
} from "@/components/app/primitives";
import { books, getBook, highlights } from "@/lib/library-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/highlights")({
  head: () => ({
    meta: [
      { title: "Highlights — Marginalia" },
      {
        name: "description",
        content:
          "Every passage you marked, with enough surrounding context to still mean something months later.",
      },
      { property: "og:title", content: "Highlights — Marginalia" },
      {
        property: "og:description",
        content: "Your captured passages, grouped by book and searchable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HighlightsPage,
});

function HighlightsPage() {
  const [filter, setFilter] = useState("All books");
  const [query, setQuery] = useState("");

  const bookFilters = [
    "All books",
    ...Array.from(new Set(highlights.map((h) => getBook(h.bookId)?.title ?? ""))),
  ];

  const visible = highlights.filter((h) => {
    const inBook =
      filter === "All books" || getBook(h.bookId)?.title === filter;
    const inQuery =
      !query ||
      h.text.toLowerCase().includes(query.toLowerCase()) ||
      (h.note ?? "").toLowerCase().includes(query.toLowerCase());
    return inBook && inQuery;
  });

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Highlights"
          meta={`${highlights.length} passages across ${books.length} books — your raw material, untouched by synthesis`}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full max-w-xs">
            <SearchInput
              placeholder="Search highlights"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {bookFilters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-xs border px-2 py-1 text-2xs transition-colors",
                  f === filter
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted-foreground hover:bg-hover",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {visible.length ? (
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {visible.map((h) => (
                <li key={h.id} className="py-6">
                  <p className="max-w-[72ch] border-l-2 border-highlight pl-4 font-serif text-lg leading-[1.55] text-foreground">
                    {h.text}
                  </p>
                  {h.note ? (
                    <p className="mt-3 max-w-[72ch] pl-4 text-sm leading-[1.6] text-muted-foreground">
                      <span className="text-2xs uppercase tracking-[0.08em] text-faint">
                        Your note ·{" "}
                      </span>
                      {h.note}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4">
                    <Link
                      to="/read/$bookId"
                      params={{ bookId: h.bookId }}
                      className="text-xs font-medium text-foreground hover:text-accent"
                    >
                      {getBook(h.bookId)?.title}
                    </Link>
                    <span className="text-xs text-faint">
                      {h.chapter} · {h.date}
                    </span>
                    {h.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-xs border border-border px-1.5 py-0.5 text-2xs text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              line="Nothing matches that"
              explanation="Try a different book filter or a shorter search."
            />
          )}
        </div>
      </Page>
    </AppShell>
  );
}
