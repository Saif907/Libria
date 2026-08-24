import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Headphones,
  List,
  MessageSquareQuote,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { AskBody } from "@/components/app/AskPanel";
import { Button, IconButton, ProgressBar } from "@/components/app/primitives";
import { getBook, passage } from "@/lib/library-data";
import { sentencesOf, type Answer, type Scope } from "@/lib/ask-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/read/$bookId")({
  loader: ({ params }) => {
    const book = getBook(params.bookId);
    if (!book) throw notFound();
    return { book };
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
    const title = `Reading ${book.title} — Marginalia`;
    const description = `Read ${book.title} by ${book.author} with synced audio, highlights and grounded answers from your own library.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
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

function Reader() {
  const { book } = Route.useLoaderData();
  const [toc, setToc] = useState(false);
  const [type, setType] = useState(false);
  const [ask, setAsk] = useState(false);
  const [scope, setScope] = useState<Scope>("page");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [playingSentence, setPlayingSentence] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({
    Font: "Literata",
    Size: "19",
    Leading: "Normal",
    Width: "Standard",
    Theme: "Paper",
  });

  const chapterIndex = Math.floor(book.progress * book.chapters.length);
  const chapter = book.chapters[chapterIndex] ?? book.chapters[0]!;

  const measure =
    settings["Width"] === "Narrow"
      ? "max-w-[600px]"
      : settings["Width"] === "Wide"
        ? "max-w-[800px]"
        : "max-w-[700px]";

  const openAskWith = (text: string | null, nextScope: Scope) => {
    setSelected(text);
    setScope(nextScope);
    setAnswer(null);
    setAsk(true);
  };

  return (
    <div className="min-h-screen bg-background">
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
            <p className="truncate text-xs text-faint">{chapter.title}</p>
          </div>
          <span className="hidden font-mono text-2xs text-faint sm:inline">
            {Math.round(book.progress * 100)}%
          </span>
          <IconButton label="Contents" onClick={() => setToc(true)}>
            <List size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Typography" onClick={() => setType((t) => !t)}>
            <TypeIcon size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label="Listen"
            onClick={() =>
              setPlayingSentence((s) =>
                s ? null : sentencesOf(passage[2] ?? "")[0] ?? null,
              )
            }
          >
            <Headphones size={18} strokeWidth={1.75} />
          </IconButton>
          <Button size="sm" onClick={() => openAskWith(null, "page")}>
            Ask
          </Button>
        </div>
        <ProgressBar value={book.progress} className="h-[2px]" />
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
            className={cn("mx-auto px-6 pb-32 pt-12 sm:px-8", measure)}
            style={{
              fontSize: `${settings["Size"]}px`,
            }}
          >
            <p className="mb-2 text-2xs uppercase tracking-[0.1em] text-faint">
              Chapter {chapterIndex + 1}
            </p>
            <h1 className="mb-9 font-serif text-3xl font-semibold leading-[1.2] tracking-[-0.015em] text-foreground">
              {chapter.title}
            </h1>

            <div
              className="prose-book space-y-6"
              style={{
                lineHeight:
                  settings["Leading"] === "Tight"
                    ? 1.5
                    : settings["Leading"] === "Loose"
                      ? 1.85
                      : 1.65,
              }}
            >
              {passage.map((p, pi) => (
                <p key={pi}>
                  {sentencesOf(p).map((s, si) => {
                    const plain = s.replace(/<[^>]+>/g, "");
                    const isPlaying = playingSentence === s;
                    const isSelected = selected === plain;
                    return (
                      <span
                        key={si}
                        onClick={() => {
                          setSelected(plain);
                          if (playingSentence) setPlayingSentence(s);
                        }}
                        className={cn(
                          "cursor-text transition-colors",
                          isPlaying && "bg-highlight",
                          isSelected && !isPlaying && "bg-accent-soft",
                        )}
                        dangerouslySetInnerHTML={{ __html: `${s} ` }}
                      />
                    );
                  })}
                </p>
              ))}
            </div>

            <div className="mt-14 flex items-center justify-between border-t border-border-subtle pt-5 text-sm">
              <span className="text-faint">
                p. {Math.round(book.progress * book.pages)} of {book.pages}
              </span>
              <button
                onClick={() => openAskWith(null, "chapter")}
                className="text-accent hover:underline"
              >
                Ask about this chapter
              </button>
            </div>
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
                contextDetail={`${chapter.title} · p. ${Math.round(book.progress * book.pages)}`}
                {...(selected ? { contextPassage: selected } : {})}
                answer={answer}
                setAnswer={setAnswer}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* Selection toolbar */}
      {selected && !ask ? (
        <div className="fixed bottom-8 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-sm border border-border bg-reading p-1 shadow-panel">
            <Button size="sm" variant="tertiary">
              Highlight
            </Button>
            <Button size="sm" variant="tertiary">
              Note
            </Button>
            <Button size="sm" onClick={() => openAskWith(selected, "selection")}>
              <MessageSquareQuote size={14} strokeWidth={1.75} />
              Ask
            </Button>
            <Button size="sm" variant="tertiary">
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
              {book.chapters.map((c, i) => (
                <li key={c.id}>
                  <button
                    onClick={() => setToc(false)}
                    className={cn(
                      "flex w-full items-baseline gap-3 rounded-sm px-2.5 py-2.5 text-left transition-colors hover:bg-hover",
                      i === chapterIndex && "bg-active",
                    )}
                  >
                    <span className="font-mono text-2xs text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 font-serif text-sm",
                        i === chapterIndex
                          ? "text-accent"
                          : "text-foreground",
                      )}
                    >
                      {c.title}
                    </span>
                    <span className="text-2xs text-faint">
                      {Math.round(c.words / 220)}m
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
