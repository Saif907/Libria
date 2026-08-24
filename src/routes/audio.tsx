import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Moon,
  Pause,
  Play,
  Rewind,
  FastForward,
  SkipBack,
  SkipForward,
} from "lucide-react";
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
import { audioQueue, continueListening, nowPlaying } from "@/lib/ask-data";
import { getBook, passage } from "@/lib/library-data";
import { sentencesOf } from "@/lib/ask-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audio")({
  head: () => ({
    meta: [
      { title: "Audio — Marginalia" },
      {
        name: "description",
        content:
          "Listen to your books with the text in sync — one reading position shared between audio and page.",
      },
      { property: "og:title", content: "Audio — Marginalia" },
      {
        property: "og:description",
        content: "Now playing, queue and continue listening across your library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AudioPage,
});

const speeds = ["0.75×", "1×", "1.25×", "1.5×", "2×"];

function AudioPage() {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState("1×");
  const [sleep, setSleep] = useState("Off");
  const book = getBook(nowPlaying.bookId)!;
  const currentSentence = sentencesOf(passage[4] ?? "")[0] ?? "";

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Audio"
          meta="The same books, the same position — read or listened to"
        />

        <section className="flex flex-col gap-8 border-y border-border-subtle py-9 sm:flex-row">
          <BookCover book={book} width={168} />
          <div className="min-w-0 flex-1">
            <p className="text-2xs uppercase tracking-[0.1em] text-faint">
              Now playing
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold leading-[1.2] text-foreground">
              {book.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {book.author} · {nowPlaying.chapter}
            </p>

            <p className="mt-6 max-w-[60ch] border-l-2 border-highlight pl-3 font-serif text-base leading-[1.6] text-foreground">
              {currentSentence.replace(/<[^>]+>/g, "")}
            </p>

            <div className="mt-7 max-w-md">
              <ProgressBar value={nowPlaying.progress ?? 0} />
              <div className="mt-1.5 flex justify-between font-mono text-2xs text-faint">
                <span>{nowPlaying.elapsed}</span>
                <span>{nowPlaying.duration}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <IconButton label="Previous chapter">
                <SkipBack size={18} strokeWidth={1.75} />
              </IconButton>
              <IconButton label="Back 15 seconds">
                <Rewind size={18} strokeWidth={1.75} />
              </IconButton>
              <button
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause" : "Play"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-sm bg-accent text-accent-foreground transition-colors hover:bg-accent-dark"
              >
                {playing ? (
                  <Pause size={18} strokeWidth={2} />
                ) : (
                  <Play size={18} strokeWidth={2} />
                )}
              </button>
              <IconButton label="Forward 30 seconds">
                <FastForward size={18} strokeWidth={1.75} />
              </IconButton>
              <IconButton label="Next chapter">
                <SkipForward size={18} strokeWidth={1.75} />
              </IconButton>

              <div className="ml-2 flex items-center gap-1">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      "rounded-xs border px-2 py-1 font-mono text-2xs transition-colors",
                      s === speed
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted-foreground hover:bg-hover",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  setSleep((v) =>
                    v === "Off" ? "End of chapter" : v === "End of chapter" ? "30 min" : "Off",
                  )
                }
                className="ml-2 inline-flex items-center gap-1.5 rounded-xs border border-border px-2 py-1 text-2xs text-muted-foreground hover:bg-hover"
              >
                <Moon size={13} strokeWidth={1.75} />
                Sleep · {sleep}
              </button>
            </div>

            <div className="mt-6">
              <Link to="/read/$bookId" params={{ bookId: book.id }}>
                <Button>Follow along in the text</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionTitle aside={<span className="text-xs text-faint">{audioQueue.length} items</span>}>
            Up next
          </SectionTitle>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {audioQueue.map((item) => {
              const b = getBook(item.bookId)!;
              return (
                <li
                  key={`${item.bookId}-${item.chapter}`}
                  className="flex items-center gap-4 py-3.5"
                >
                  <BookCover book={b} width={32} float={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {item.chapter}
                    </p>
                    <p className="truncate text-xs text-faint">{b.title}</p>
                  </div>
                  <span className="font-mono text-2xs text-faint">
                    {item.duration}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-12">
          <SectionTitle>Continue listening</SectionTitle>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {continueListening.map((item) => {
              const b = getBook(item.bookId)!;
              return (
                <li key={item.bookId} className="flex items-center gap-4 py-4">
                  <BookCover book={b} width={40} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/book/$bookId"
                      params={{ bookId: b.id }}
                      className="text-sm font-medium text-foreground hover:text-accent"
                    >
                      {b.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-faint">
                      {item.chapter} · {item.duration}
                    </p>
                    <div className="mt-2 max-w-xs">
                      <ProgressBar value={item.progress ?? 0} />
                    </div>
                  </div>
                  <Button size="sm">
                    {item.progress === 1 ? "Finished" : "Resume"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </Page>
    </AppShell>
  );
}
