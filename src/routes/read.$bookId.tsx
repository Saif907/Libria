import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  List,
  MessageSquareQuote,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { AskBody } from "@/components/app/AskPanel";
import { Button, IconButton, ProgressBar } from "@/components/app/primitives";
import {
  WORDS_PER_MINUTE,
  formatMinutes,
  getBookDetail,
  getChapterContent,
  hasPdf,
} from "@/lib/books";
import { useProgress } from "@/lib/reading-progress";
import type { Answer, Scope } from "@/lib/ask-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/read/$bookId")({
  validateSearch: (s: Record<string, unknown>): { chapter?: number } => {
    const raw = s["chapter"];
    const index = typeof raw === "number" ? raw : Number(raw);
    return Number.isInteger(index) && index >= 0 ? { chapter: index } : {};
  },
  loaderDeps: ({ search }) => ({ chapter: search.chapter ?? 0 }),
  loader: async ({ params, deps }) => {
    // Both calls share the server's parsed-book cache, so this is one download
    // no matter how many chapters you turn.
    const [detail, content] = await Promise.all([
      getBookDetail({ data: { bookId: params.bookId } }),
      getChapterContent({ data: { bookId: params.bookId, index: deps.chapter } }),
    ]);
    if (!detail || !content) throw notFound();
    return { book: detail.book, chapters: detail.chapters, content };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Unavailable — Marginalia" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { book, content } = loaderData;
    const title = `${content.title} — ${book.title} — Marginalia`;
    const description = `Read ${book.title} by ${book.author} from your own library.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
        // A private library has nothing to gain from being indexed.
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: Reader,
});

const typeSettings = [
  { label: "Font", options: ["Literata", "Georgia", "Iowan"] },
  { label: "Size", options: ["17", "19", "21", "23"] },
  { label: "Leading", options: ["Tight", "Normal", "Loose"] },
  { label: "Width", options: ["Narrow", "Standard", "Wide"] },
  { label: "Theme", options: ["Paper", "Sepia", "Night"] },
];

const fontStacks: Record<string, string> = {
  Literata: '"Literata", Georgia, "Times New Roman", serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  Iowan: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
};

const leadings: Record<string, string> = {
  Tight: "1.5",
  Normal: "1.65",
  Loose: "1.85",
};

const measures: Record<string, string> = {
  Narrow: "max-w-[600px]",
  Standard: "max-w-[700px]",
  Wide: "max-w-[800px]",
};

/**
 * Sepia re-points the design tokens for the reader subtree only, so every
 * token-based class inside follows without a second set of components. Night
 * reuses the app's existing `dark` variant the same way.
 */
const sepiaTokens: Record<string, string> = {
  "--background": "oklch(0.955 0.022 84)",
  "--reading": "oklch(0.978 0.015 86)",
  "--surface": "oklch(0.932 0.026 82)",
  "--foreground": "oklch(0.27 0.016 60)",
};

function Reader() {
  const { book, chapters, content } = Route.useLoaderData();
  const navigate = useNavigate();
  const { save } = useProgress(book.id);

  const [toc, setToc] = useState(false);
  const [type, setType] = useState(false);
  const [ask, setAsk] = useState(false);
  const [scope, setScope] = useState<Scope>("page");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({
    Font: "Literata",
    Size: "19",
    Leading: "Normal",
    Width: "Standard",
    Theme: "Paper",
  });

  const articleRef = useRef<HTMLElement>(null);

  const index = content.index;
  const total = chapters.length;
  const fraction = total > 0 ? (index + 1) / total : 0;

  // Opening a chapter is what marks it read; there is no scroll tracking behind
  // this, so the position is honest about being chapter-level.
  useEffect(() => {
    save(index, total);
  }, [save, index, total]);

  // Real text selection, replacing the old click-a-sentence stand-in. Only
  // selections inside the article body open the toolbar.
  useEffect(() => {
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelected(null);
        return;
      }
      const anchor = selection.anchorNode;
      if (!anchor || !articleRef.current?.contains(anchor)) return;

      const text = selection.toString().replace(/\s+/g, " ").trim();
      setSelected(text.length > 1 ? text : null);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // Chapter turns are locations, so the selection from the previous one is stale.
  useEffect(() => setSelected(null), [index]);

  const goToChapter = (next: number) => {
    if (next < 0 || next >= total) return;
    void navigate({
      to: "/read/$bookId",
      params: { bookId: book.id },
      search: { chapter: next },
    });
  };

  const openAskWith = (text: string | null, nextScope: Scope) => {
    setSelected(text);
    setScope(nextScope);
    setAnswer(null);
    setAsk(true);
  };

  const readerVars = {
    "--reader-size": `${settings["Size"]}px`,
    "--reader-leading": leadings[settings["Leading"] ?? "Normal"],
    "--font-serif": fontStacks[settings["Font"] ?? "Literata"],
    ...(settings["Theme"] === "Sepia" ? sepiaTokens : {}),
  } as CSSProperties;

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        settings["Theme"] === "Night" && "dark",
      )}
      style={readerVars}
    >
      {/* Reader chrome */}
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <Link to="/book/$bookId" params={{ bookId: book.id }}>
            <IconButton label="Back to book">
              <ArrowLeft size={18} strokeWidth={1.75} />
            </IconButton>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-foreground">
              {book.title}
            </p>
            <p className="truncate text-xs text-faint">{content.title}</p>
          </div>
          <span className="hidden font-mono text-2xs text-faint sm:inline">
            {Math.round(fraction * 100)}%
          </span>
          <IconButton label="Contents" onClick={() => setToc(true)}>
            <List size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Typography" onClick={() => setType((t) => !t)}>
            <TypeIcon size={18} strokeWidth={1.75} />
          </IconButton>
          {/* Switching to the scan is useful where the conversion lost a table
              or a diagram, so it stays one click away while reading. */}
          {hasPdf(book) ? (
            <Link to="/pdf/$bookId" params={{ bookId: book.id }}>
              <IconButton label="View original PDF">
                <FileText size={18} strokeWidth={1.75} />
              </IconButton>
            </Link>
          ) : null}
          <Link to="/audio">
            <IconButton label="Listen">
              <Headphones size={18} strokeWidth={1.75} />
            </IconButton>
          </Link>
          <Button size="sm" onClick={() => openAskWith(null, "chapter")}>
            Ask
          </Button>
        </div>
        <ProgressBar value={fraction} className="h-[2px]" />
      </header>

      {type ? (
        <div className="border-b border-border-subtle bg-surface">
          <div className="mx-auto flex max-w-[700px] flex-wrap gap-6 px-6 py-4">
            {typeSettings.map((s) => (
              <div key={s.label}>
                <p className="mb-1.5 text-2xs uppercase tracking-[0.08em] text-faint">
                  {s.label}
                </p>
                <div className="flex gap-1">
                  {s.options.map((o) => (
                    <button
                      key={o}
                      onClick={() =>
                        setSettings((p) => ({ ...p, [s.label]: o }))
                      }
                      className={cn(
                        "rounded-xs border px-2 py-1 text-2xs transition-colors",
                        settings[s.label] === o
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border text-muted-foreground hover:bg-hover",
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn("flex", ask && "lg:mr-[440px]")}>
        <main className="min-w-0 flex-1">
          <article
            ref={articleRef}
            className={cn(
              "mx-auto px-6 pb-32 pt-12 sm:px-8",
              measures[settings["Width"] ?? "Standard"],
            )}
          >
            <p className="mb-2 text-2xs uppercase tracking-[0.1em] text-faint">
              Chapter {index + 1} of {total}
            </p>
            <h1 className="mb-9 font-serif text-3xl font-semibold leading-[1.2] tracking-[-0.015em] text-foreground">
              {content.title}
            </h1>

            {content.words > 0 ? (
              <Streamdown
                mode="static"
                // The chapter is complete text, not a stream: no missing
                // delimiters to repair, and no copy/download chrome wanted.
                parseIncompleteMarkdown={false}
                controls={false}
                className="prose-book"
              >
                {content.markdown}
              </Streamdown>
            ) : (
              <p className="text-sm text-muted-foreground">
                This section has no text — the conversion produced only a
                heading here.
              </p>
            )}

            <nav className="mt-14 flex items-center justify-between gap-4 border-t border-border-subtle pt-5 text-sm">
              <Button
                size="sm"
                variant="tertiary"
                disabled={index === 0}
                onClick={() => goToChapter(index - 1)}
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
                Previous
              </Button>
              <span className="text-faint">
                {formatMinutes(content.words / WORDS_PER_MINUTE)} in this chapter
              </span>
              <Button
                size="sm"
                variant="tertiary"
                disabled={index >= total - 1}
                onClick={() => goToChapter(index + 1)}
              >
                Next
                <ChevronRight size={14} strokeWidth={1.75} />
              </Button>
            </nav>
          </article>
        </main>

        {ask ? (
          <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-border bg-background shadow-panel">
            <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="text-sm font-medium text-foreground">Ask</span>
              <IconButton label="Close Ask panel" onClick={() => setAsk(false)}>
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <AskBody
                scope={scope}
                setScope={setScope}
                contextDetail={`${content.title} · chapter ${index + 1} of ${total}`}
                {...(selected ? { contextPassage: selected } : {})}
                answer={answer}
                setAnswer={setAnswer}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* Selection toolbar. mousedown is prevented so clicking a button does not
          collapse the selection out from under it. */}
      {selected && !ask ? (
        <div
          className="fixed bottom-8 left-1/2 z-30 -translate-x-1/2"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-1 rounded-sm border border-border bg-reading p-1 shadow-panel">
            <Button
              size="sm"
              variant="tertiary"
              disabled
              title="Saving highlights needs a store behind it — not wired up yet"
            >
              Highlight
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              disabled
              title="Saving notes needs a store behind it — not wired up yet"
            >
              Note
            </Button>
            <Button size="sm" onClick={() => openAskWith(selected, "selection")}>
              <MessageSquareQuote size={14} strokeWidth={1.75} />
              Ask
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              onClick={() => {
                void navigator.clipboard?.writeText(selected);
                setSelected(null);
              }}
            >
              Copy
            </Button>
            <IconButton
              label="Dismiss selection"
              onClick={() => setSelected(null)}
            >
              <X size={15} strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>
      ) : null}

      {/* Contents slide-over */}
      {toc ? (
        <>
          <button
            aria-label="Close contents"
            className="fixed inset-0 z-40 bg-foreground/15"
            onClick={() => setToc(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-[340px] overflow-y-auto border-r border-border bg-background">
            <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="text-sm font-medium text-foreground">
                Contents
              </span>
              <IconButton label="Close contents" onClick={() => setToc(false)}>
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </header>
            <ul className="px-2 py-2">
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <Link
                    to="/read/$bookId"
                    params={{ bookId: book.id }}
                    search={{ chapter: i }}
                    onClick={() => setToc(false)}
                    className={cn(
                      "flex w-full items-baseline gap-3 rounded-sm px-2.5 py-2.5 text-left transition-colors hover:bg-hover",
                      i === index && "bg-active",
                    )}
                  >
                    <span className="font-mono text-2xs text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 font-serif text-sm",
                        i === index ? "text-accent" : "text-foreground",
                      )}
                    >
                      {c.title}
                    </span>
                    <span className="text-2xs text-faint">
                      {Math.max(1, Math.round(c.words / WORDS_PER_MINUTE))}m
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </>
      ) : null}
    </div>
  );
}
