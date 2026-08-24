import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getBook } from "@/lib/library-data";
import {
  groundingLabel,
  scopeLabel,
  scopeOrder,
  type Answer,
  type Citation,
  type Contradiction,
  type Grounding,
  type Scope,
} from "@/lib/ask-data";
import { BookCover } from "./primitives";

/* ---------- Grounding ---------- */

const groundingTone: Record<Grounding, string> = {
  grounded: "border-accent text-accent",
  synthesis: "border-accent text-accent",
  conflict: "border-warning text-warning",
  inference: "border-border text-muted-foreground",
  "not-found": "border-danger text-danger",
};

export function GroundingBadge({ grounding }: { grounding: Grounding }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-2xs font-medium tracking-[0.01em]",
        groundingTone[grounding],
      )}
    >
      {groundingLabel[grounding]}
    </span>
  );
}

/* ---------- Scope ---------- */

export function ScopeSelector({
  scope,
  onChange,
  available = scopeOrder,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
  available?: Scope[] | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {available.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "rounded-xs border px-2 py-1 text-2xs font-medium transition-colors duration-150",
            s === scope
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
          )}
        >
          {scopeLabel[s]}
        </button>
      ))}
    </div>
  );
}

export function ContextPreview({
  scope,
  detail,
  passage,
}: {
  scope: Scope;
  detail: string;
  passage?: string | undefined;
}) {
  return (
    <div className="border-l-2 border-accent bg-surface px-3 py-2.5">
      <p className="text-metadata text-xs uppercase tracking-[0.08em] text-faint">
        Reading context
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {scopeLabel[scope]} · {detail}
      </p>
      {passage ? (
        <p className="mt-2 font-serif text-sm leading-[1.55] text-foreground">
          “{passage}”
        </p>
      ) : null}
    </div>
  );
}

/* ---------- Citations ---------- */

export function CitationCard({
  citation,
  index,
}: {
  citation: Citation;
  index?: number | undefined;
}) {
  const book = getBook(citation.bookId);
  if (!book) return null;
  return (
    <li className="flex gap-3 py-3.5">
      <Link
        to="/read/$bookId"
        params={{ bookId: book.id }}
        className="shrink-0"
        aria-label={`Open ${book.title}`}
      >
        <BookCover book={book} width={34} float={false} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {index !== undefined ? (
            <span className="font-mono text-2xs text-faint">[{index}]</span>
          ) : null}
          <span className="text-sm font-medium text-foreground">
            {book.title}
          </span>
          <span className="text-xs text-muted-foreground">{book.author}</span>
        </div>
        <p className="mt-0.5 text-xs text-faint">
          {citation.chapter} · p. {citation.page}
        </p>
        <p className="mt-2 border-l border-border pl-3 font-serif text-sm leading-[1.55] text-foreground">
          {citation.passage}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {citation.relevance}
          </span>
          <Link
            to="/read/$bookId"
            params={{ bookId: book.id }}
            className="shrink-0 text-xs font-medium text-accent hover:underline"
          >
            Jump to source
          </Link>
        </div>
      </div>
    </li>
  );
}

export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <ul className="divide-y divide-border-subtle border-t border-border-subtle">
      {citations.map((c, i) => (
        <CitationCard key={`${c.bookId}-${c.page}`} citation={c} index={i + 1} />
      ))}
    </ul>
  );
}

/* ---------- Contradiction ---------- */

export function ContradictionCard({ item }: { item: Contradiction }) {
  const a = getBook(item.claimBookId);
  const b = getBook(item.counterBookId);
  return (
    <div className="border-t border-border-subtle py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-metadata text-2xs uppercase tracking-[0.08em] text-faint">
            {a?.author ?? item.claimBookId}
          </p>
          <p className="mt-1.5 font-serif text-base leading-[1.5] text-foreground">
            {item.claim}
          </p>
        </div>
        <div className="sm:border-l sm:border-border-subtle sm:pl-4">
          <p className="text-metadata text-2xs uppercase tracking-[0.08em] text-faint">
            {b?.author ?? item.counterBookId}
          </p>
          <p className="mt-1.5 font-serif text-base leading-[1.5] text-foreground">
            {item.counterClaim}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Reading: </span>
        {item.reading}
      </p>
    </div>
  );
}

/* ---------- Answer ---------- */

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-2.5 text-2xs font-medium uppercase tracking-[0.1em] text-faint">
        {label}
      </h3>
      {children}
    </section>
  );
}

export function AnswerBlock({ answer }: { answer: Answer }) {
  const bookCount = new Set(answer.citations.map((c) => c.bookId)).size;
  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <GroundingBadge grounding={answer.grounding} />
        <span className="text-xs text-muted-foreground">
          {scopeLabel[answer.scope]}
          {answer.citations.length > 0
            ? ` · ${answer.citations.length} passages · ${bookCount} ${bookCount === 1 ? "book" : "books"}`
            : ""}
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        {answer.answer.map((p) => (
          <p key={p} className="text-[0.9375rem] leading-[1.62] text-foreground">
            {p}
          </p>
        ))}
      </div>

      {answer.reasoning ? (
        <Block label="How these sources were combined">
          <p className="border-l border-border pl-3 text-sm leading-[1.6] text-muted-foreground">
            {answer.reasoning}
          </p>
        </Block>
      ) : null}

      {answer.dimensions?.length ? (
        <Block label="Dimensions considered">
          <div className="flex flex-wrap gap-1.5">
            {answer.dimensions.map((d) => (
              <span
                key={d}
                className="rounded-xs border border-border px-2 py-0.5 text-2xs text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>
        </Block>
      ) : null}

      {answer.perspectives?.length ? (
        <Block label="Perspectives">
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {answer.perspectives.map((p) => (
              <li key={p.dimension} className="py-3">
                <p className="text-sm font-medium text-foreground">
                  {p.dimension}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {getBook(p.bookId)?.title}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-[1.6] text-muted-foreground">
                  {p.contribution}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {answer.agreements?.length ? (
        <Block label="Where sources agree">
          <ul className="space-y-2">
            {answer.agreements.map((a) => (
              <li key={a} className="flex gap-2.5 text-sm text-foreground">
                <span className="text-accent" aria-hidden>
                  —
                </span>
                {a}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {answer.contradictions?.length ? (
        <Block label="Where sources disagree">
          <div>
            {answer.contradictions.map((c) => (
              <ContradictionCard key={c.claim} item={c} />
            ))}
          </div>
        </Block>
      ) : null}

      {answer.practical?.length ? (
        <Block label="Practical synthesis · Marginalia's interpretation">
          <ol className="space-y-2 border-l-2 border-accent pl-4">
            {answer.practical.map((p, i) => (
              <li key={p} className="text-sm leading-[1.6] text-foreground">
                <span className="mr-2 font-mono text-2xs text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </Block>
      ) : null}

      <Block label={`Evidence · ${answer.citations.length} passages`}>
        {answer.citations.length ? (
          <CitationList citations={answer.citations} />
        ) : (
          <p className="border-t border-border-subtle pt-3 text-sm text-muted-foreground">
            No passages in your library support this answer.
          </p>
        )}
      </Block>
    </article>
  );
}
