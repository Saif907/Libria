import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, type CSSProperties } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Headphones,
  List,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Search,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { AskBody } from "@/components/app/AskPanel";
import { Button, IconButton, ProgressBar } from "@/components/app/primitives";
import {
  WORDS_PER_MINUTE,
  formatMinutes,
  getBookFullContent,
  hasPdf,
} from "@/lib/books";
import { useProgress } from "@/lib/reading-progress";
import type { Answer, Scope } from "@/lib/ask-data";
import { cn } from "@/lib/utils";
import { useResizableSidebar, SidebarResizeHandle } from "@/hooks/use-resizable-sidebar";

export const Route = createFileRoute("/read/$bookId")({
  validateSearch: (s: Record<string, unknown>): { chapter?: number } => {
    const raw = s["chapter"];
    const index = typeof raw === "number" ? raw : Number(raw);
    return Number.isInteger(index) && index >= 0 ? { chapter: index } : {};
  },
  staleTime: 60_000,
  gcTime: 15 * 60_000,
  loader: async ({ params }) => {
    const data = await getBookFullContent({ data: { bookId: params.bookId } });
    if (!data || !data.book) throw notFound();
    return data;
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
    const { book } = loaderData;
    const title = `${book.title} — Marginalia`;
    const description = `Read ${book.title} by ${book.author} from your own library.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
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

const sepiaTokens: Record<string, string> = {
  "--background": "oklch(0.955 0.022 84)",
  "--reading": "oklch(0.978 0.015 86)",
  "--surface": "oklch(0.932 0.026 82)",
  "--foreground": "oklch(0.27 0.016 60)",
};

function highlightMatchInSnippet(snippet: string, query: string) {
  if (!query.trim()) return snippet;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = snippet.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-accent/30 text-accent font-semibold px-0.5 rounded-2xs">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function Reader() {
  const { book, chapters } = Route.useLoaderData();
  const search = Route.useSearch();
  const initialChapter = search.chapter ?? 0;

  const { save } = useProgress(book.id);

  const [activeIndex, setActiveIndex] = useState(
    initialChapter >= 0 && initialChapter < chapters.length ? initialChapter : 0
  );

  const [toc, setToc] = useState(false);
  const [type, setType] = useState(false);
  const [ask, setAsk] = useState(false);
  const [scope, setScope] = useState<Scope>("chapter");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // In-book Keyword Search State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showResultsList, setShowResultsList] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    isWide: isSidebarWide,
    isDragging: isSidebarDragging,
    handlePointerDown: handleSidebarResize,
    resetWidth: resetSidebarWidth,
    toggleWide: toggleSidebarWide,
    asideStyle,
  } = useResizableSidebar();

  const [settings, setSettings] = useState<Record<string, string>>({
    Font: "Literata",
    Size: "19",
    Leading: "Normal",
    Width: "Standard",
    Theme: "Paper",
  });

  const scrollContainerRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);

  const total = chapters.length;
  const currentChapter = chapters[activeIndex] || chapters[0];
  const fraction = total > 0 ? (activeIndex + 1) / total : 0;

  // Save progress initially on mount
  useEffect(() => {
    save(activeIndex, total);
  }, [save, activeIndex, total]);

  // Initial scroll to targeted chapter if ?chapter= query param was supplied
  useEffect(() => {
    if (initialChapter > 0 && chapters.length > initialChapter) {
      const timer = setTimeout(() => {
        const el = chapterRefs.current[initialChapter];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialChapter, chapters.length]);

  // Scroll listener: detects active chapter based on reading container scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || chapters.length === 0) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const containerTop = container.getBoundingClientRect().top;
          const targetY = containerTop + 140; // 140px below the header

          let currentIdx = 0;
          for (let i = 0; i < chapters.length; i++) {
            const el = chapterRefs.current[i];
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= targetY) {
                currentIdx = i;
              } else {
                break;
              }
            }
          }

          setActiveIndex((prev) => {
            if (prev !== currentIdx) {
              save(currentIdx, chapters.length);
              return currentIdx;
            }
            return prev;
          });

          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [chapters.length, save]);

  // Continuous selection listener across single or multi-chapter content
  useEffect(() => {
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelected(null);
        return;
      }
      const anchor = selection.anchorNode;
      const focus = selection.focusNode;
      if (!anchor || !focus) return;
      if (!articleRef.current?.contains(anchor) || !articleRef.current?.contains(focus)) return;

      const text = selection.toString().replace(/\s+/g, " ").trim();
      setSelected(text.length > 1 ? text : null);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const scrollToChapter = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= total) return;
    const el = chapterRefs.current[targetIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveIndex(targetIndex);
      save(targetIndex, total);
      setToc(false);
    }
  };

  interface SearchMatch {
    chapterIndex: number;
    chapterTitle: string;
    snippet: string;
  }

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const results: SearchMatch[] = [];
    chapters.forEach((ch, chIdx) => {
      const text = ch.markdown || "";
      const lower = text.toLowerCase();
      let pos = 0;

      while ((pos = lower.indexOf(q, pos)) !== -1) {
        const start = Math.max(0, pos - 50);
        const end = Math.min(text.length, pos + q.length + 50);
        let snippet = text.slice(start, end).replace(/\s+/g, " ");
        if (start > 0) snippet = "…" + snippet;
        if (end < text.length) snippet = snippet + "…";

        results.push({
          chapterIndex: chIdx,
          chapterTitle: ch.title,
          snippet,
        });

        pos += Math.max(1, q.length);
        if (results.length >= 250) break;
      }
    });
    return results;
  }, [searchQuery, chapters]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToChapter(searchMatches[nextIdx].chapterIndex);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToChapter(searchMatches[prevIdx].chapterIndex);
  };

  const jumpToMatch = (idx: number) => {
    if (idx < 0 || idx >= searchMatches.length) return;
    setCurrentMatchIndex(idx);
    scrollToChapter(searchMatches[idx].chapterIndex);
  };

  // Keyboard shortcut listener (Ctrl+F, Cmd+F, Ctrl+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "k")) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        "h-[100dvh] flex flex-col bg-background overflow-hidden select-text",
        settings["Theme"] === "Night" && "dark",
      )}
      style={readerVars}
    >
      {/* Reader chrome */}
      <header className="shrink-0 z-30 border-b border-border-subtle bg-background/95 backdrop-blur">
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
            <p className="truncate text-xs text-faint">
              {currentChapter?.title || "Reading"}
            </p>
          </div>
          <span className="hidden font-mono text-2xs text-faint sm:inline">
            {Math.round(fraction * 100)}%
          </span>
          <IconButton
            label={searchOpen ? "Close search (Esc)" : "Search in book (Ctrl+F)"}
            onClick={() => {
              setSearchOpen((s) => !s);
              if (!searchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 60);
              }
            }}
          >
            <Search size={18} strokeWidth={1.75} className={searchOpen ? "text-accent" : ""} />
          </IconButton>
          <IconButton label="Contents" onClick={() => setToc(true)}>
            <List size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Typography" onClick={() => setType((t) => !t)}>
            <TypeIcon size={18} strokeWidth={1.75} />
          </IconButton>
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
          <Button
            size="sm"
            variant={ask ? "primary" : "secondary"}
            onClick={() => setAsk((p) => !p)}
            className="gap-1.5 text-xs"
          >
            <MessageSquareQuote size={14} strokeWidth={1.75} />
            <span>Ask AI</span>
          </Button>
        </div>
        <ProgressBar value={fraction} className="h-[2px]" />
      </header>

      {/* Search Toolbar */}
      {searchOpen ? (
        <div className="border-b border-border-subtle bg-surface/95 backdrop-blur px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-xs animate-in slide-in-from-top-2 duration-150 z-20">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-background border border-border rounded-md px-2.5 py-1 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) {
                    handlePrevMatch();
                  } else {
                    handleNextMatch();
                  }
                } else if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              placeholder="Search keyword or phrase in book…"
              className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-faint focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentMatchIndex(0);
                }}
                className="text-faint hover:text-foreground shrink-0 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
            {searchQuery.trim() ? (
              <span className="font-mono text-2xs text-muted-foreground px-1">
                {searchMatches.length > 0
                  ? `${currentMatchIndex + 1} of ${searchMatches.length}`
                  : "No matches"}
              </span>
            ) : null}

            <div className="flex items-center gap-0.5">
              <IconButton
                label="Previous match (Shift+Enter)"
                onClick={handlePrevMatch}
                disabled={searchMatches.length === 0}
              >
                <ChevronUp size={15} />
              </IconButton>
              <IconButton
                label="Next match (Enter)"
                onClick={handleNextMatch}
                disabled={searchMatches.length === 0}
              >
                <ChevronDown size={15} />
              </IconButton>
            </div>

            {searchMatches.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowResultsList((prev) => !prev)}
                className={cn(
                  "text-2xs font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 cursor-pointer",
                  showResultsList
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted-foreground hover:bg-hover hover:text-foreground"
                )}
                title="Toggle search results list"
              >
                <List size={12} />
                <span>Matches</span>
              </button>
            ) : null}

            <IconButton label="Close search (Esc)" onClick={() => setSearchOpen(false)}>
              <X size={16} />
            </IconButton>
          </div>
        </div>
      ) : null}

      {/* Expandable Search Results Drawer with snippets */}
      {searchOpen && showResultsList && searchMatches.length > 0 ? (
        <div className="border-b border-border bg-background/95 backdrop-blur max-h-60 overflow-y-auto z-20 px-3 sm:px-6 py-2 divide-y divide-border-subtle shadow-md">
          {searchMatches.map((m, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => jumpToMatch(idx)}
              className={cn(
                "w-full text-left py-2 px-2.5 rounded-sm transition-colors text-xs flex flex-col gap-1 cursor-pointer",
                idx === currentMatchIndex
                  ? "bg-accent-soft/40 border-l-2 border-accent"
                  : "hover:bg-hover"
              )}
            >
              <div className="flex items-center justify-between text-2xs text-accent font-medium">
                <span>{m.chapterTitle}</span>
                <span className="font-mono text-faint">Match {idx + 1}</span>
              </div>
              <p className="text-foreground/80 line-clamp-2 font-serif">
                {highlightMatchInSnippet(m.snippet, searchQuery)}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {/* Typography settings bar */}
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
                        "rounded-xs border px-2 py-1 text-2xs transition-colors cursor-pointer",
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

      {/* Split Workspace: Section 1 (Continuous Reader) + Section 2 (AI Sidebar) */}
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* SECTION 1: Book Reading Section (Continuous scroll down through all chapters) */}
        <main
          ref={scrollContainerRef}
          className="min-w-0 flex-1 h-full overflow-y-auto overflow-x-hidden scroll-smooth"
        >
          <article
            ref={articleRef}
            className={cn(
              "mx-auto px-6 pb-32 pt-12 sm:px-8",
              measures[settings["Width"] ?? "Standard"],
            )}
          >
            {chapters.length > 0 ? (
              chapters.map((ch, i) => (
                <section
                  key={ch.id}
                  id={`chapter-${i}`}
                  data-chapter-index={i}
                  ref={(el) => {
                    chapterRefs.current[i] = el;
                  }}
                  className={cn(
                    "relative scroll-mt-20",
                    i > 0 ? "pt-20 mt-20 border-t border-border-subtle" : "mb-16"
                  )}
                >
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="font-mono text-2xs uppercase tracking-[0.12em] text-accent font-semibold">
                        Chapter {i + 1} of {total}
                      </span>
                      <span className="text-3xs text-faint font-mono">·</span>
                      <span className="text-3xs text-faint font-mono">
                        {formatMinutes(ch.words / WORDS_PER_MINUTE)} read
                      </span>
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl font-semibold leading-[1.2] tracking-[-0.015em] text-foreground">
                      {ch.title}
                    </h2>
                  </div>

                  {ch.words > 0 ? (
                    <Streamdown
                      mode="static"
                      parseIncompleteMarkdown={false}
                      controls={false}
                      className="prose-book"
                    >
                      {ch.markdown}
                    </Streamdown>
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-4">
                      This section has no text — the conversion produced only a heading here.
                    </p>
                  )}
                </section>
              ))
            ) : (
              <div className="py-20 text-center space-y-3">
                <p className="font-serif text-xl font-medium text-foreground">
                  No markdown chapters available for this book.
                </p>
                {hasPdf(book) && (
                  <Link to="/pdf/$bookId" params={{ bookId: book.id }}>
                    <Button variant="primary">Open PDF Viewer</Button>
                  </Link>
                )}
              </div>
            )}

            {/* End of Book Milestone */}
            {chapters.length > 0 && (
              <div className="mt-28 border-t border-border-subtle pt-14 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent border border-accent/20 shadow-2xs">
                  <CheckCircle2 size={22} />
                </div>
                <h3 className="font-serif text-2xl font-medium text-foreground">
                  End of {book.title}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  You've reached the end of all {total} chapters. Review your highlights, synthesize insights across books, or ask the AI agent.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link to="/book/$bookId" params={{ bookId: book.id }}>
                    <Button variant="secondary" size="sm">
                      Book Overview
                    </Button>
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openAskWith(null, "book")}
                    className="gap-1.5"
                  >
                    <MessageSquareQuote size={14} />
                    <span>Ask About This Book</span>
                  </Button>
                </div>
              </div>
            )}
          </article>
        </main>

        {/* SECTION 2: Ask AI Sidebar */}
        {ask ? (
          <>
            {/* Mobile backdrop */}
            <div
              className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-xs"
              onClick={() => setAsk(false)}
            />
            <aside
              style={asideStyle}
              className={cn(
                "fixed inset-y-0 right-0 z-50 flex w-full max-w-full sm:max-w-[440px] flex-col border-l border-border bg-background shadow-panel",
                "lg:relative lg:inset-auto lg:h-full lg:shrink-0 lg:max-w-none lg:shadow-none",
                "transition-[width] duration-75 ease-out",
                isSidebarDragging && "select-none transition-none"
              )}
            >
              <SidebarResizeHandle
                onPointerDown={handleSidebarResize}
                onDoubleClick={resetSidebarWidth}
                isDragging={isSidebarDragging}
              />
              <header className="flex items-center justify-between px-4 py-3 shrink-0">
                <span className="text-sm font-medium text-foreground">Ask AI</span>
                <div className="flex items-center gap-1">
                  <IconButton
                    label={isSidebarWide ? "Collapse width" : "Expand width"}
                    onClick={toggleSidebarWide}
                    className="hidden lg:inline-flex"
                  >
                    {isSidebarWide ? <Minimize2 size={15} strokeWidth={1.75} /> : <Maximize2 size={15} strokeWidth={1.75} />}
                  </IconButton>
                  <IconButton label="Close Ask panel" onClick={() => setAsk(false)}>
                    <X size={16} strokeWidth={1.75} />
                  </IconButton>
                </div>
              </header>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <AskBody
                  scope={scope}
                  setScope={setScope}
                  contextDetail={
                    selected
                      ? `Selected passage (${selected.length} chars)`
                      : `${currentChapter?.title ?? book.title} · chapter ${activeIndex + 1} of ${total}`
                  }
                  activeBookId={book.id}
                  activeBookTitle={book.title}
                  {...(selected ? { contextPassage: selected } : {})}
                  answer={answer}
                  setAnswer={setAnswer}
                  availableScopes={["selection", "chapter", "book", "library"]}
                />
              </div>
            </aside>
          </>
        ) : null}
      </div>

      {/* Floating Selection toolbar for continuous single & multi-chapter selections */}
      {selected && !ask ? (
        <div
          className="fixed bottom-8 left-1/2 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-150"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-reading/95 backdrop-blur-md px-2 py-1 shadow-lg">
            <Button
              size="sm"
              variant="primary"
              onClick={() => openAskWith(selected, "selection")}
              className="gap-1 text-xs h-7 rounded-full"
            >
              <MessageSquareQuote size={13} strokeWidth={2} />
              <span>Ask AI</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-7 rounded-full"
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
              className="h-7 w-7 rounded-full hover:bg-hover"
            >
              <X size={13} strokeWidth={2} />
            </IconButton>
          </div>
        </div>
      ) : null}

      {/* Contents (Table of Contents) slide-over with direct smooth-scroll */}
      {toc ? (
        <>
          <button
            aria-label="Close contents"
            className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-xs cursor-pointer"
            onClick={() => setToc(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-[340px] overflow-y-auto border-r border-border bg-background shadow-panel animate-in slide-in-from-left duration-200">
            <header className="flex items-center justify-between px-4 py-3 shrink-0">
              <span className="text-sm font-medium text-foreground">
                Contents
              </span>
              <IconButton label="Close contents" onClick={() => setToc(false)}>
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </header>
            <ul className="px-2 py-2 space-y-0.5">
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => scrollToChapter(i)}
                    className={cn(
                      "flex w-full items-baseline gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-hover cursor-pointer",
                      i === activeIndex ? "bg-accent-soft/50 text-accent font-medium" : "text-foreground",
                    )}
                  >
                    <span className="font-mono text-2xs text-faint shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 font-serif text-sm truncate">
                      {c.title}
                    </span>
                    <span className="text-2xs text-faint font-mono shrink-0">
                      {Math.max(1, Math.round(c.words / WORDS_PER_MINUTE))}m
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </>
      ) : null}
    </div>
  );
}
