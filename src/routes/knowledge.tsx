import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { AskPanel } from "@/components/app/AskPanel";
import {
  Button,
  Page,
  PageHeader,
  SectionTitle,
  TabBar,
} from "@/components/app/primitives";
import { AnswerBlock, ContradictionCard } from "@/components/app/Evidence";
import {
  agreements,
  answers,
  libraryContradictions,
  librarySynthesis,
  themes,
} from "@/lib/ask-data";
import { getBook, insights, openQuestions } from "@/lib/library-data";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge — Marginalia" },
      {
        name: "description",
        content:
          "Themes, agreements, contradictions and open questions synthesised across every book in your library.",
      },
      { property: "og:title", content: "Knowledge — Marginalia" },
      {
        property: "og:description",
        content:
          "What your library collectively suggests — with the evidence behind every claim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

const tabs = ["Themes", "Agreements", "Contradictions", "Open questions"];

function KnowledgePage() {
  const [tab, setTab] = useState(tabs[0]!);
  const [ask, setAsk] = useState(false);
  const [openSynthesis, setOpenSynthesis] = useState<string | null>(null);

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Knowledge"
          meta="What your library collectively suggests — never without the passages behind it"
          actions={
            <Button variant="primary" onClick={() => setAsk(true)}>
              Ask your library
            </Button>
          }
        />

        <TabBar tabs={tabs} active={tab} onChange={setTab} />

        <div className="mt-7">
          {tab === "Themes" ? (
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {themes.map((t) => (
                <li key={t.id} className="py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-serif text-xl font-semibold text-foreground">
                      {t.name}
                    </h3>
                    <span className="text-xs text-faint">
                      {t.bookIds.length} books · {t.passages} passages
                    </span>
                  </div>
                  <p className="mt-2 max-w-[70ch] text-[0.9375rem] leading-[1.62] text-muted-foreground">
                    {t.insight}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {t.bookIds.map((id) => {
                      // Resolve first: these fixture ids are legacy slugs, and
                      // the link has to carry the real one to open the book.
                      const ref = getBook(id);
                      return (
                        <Link
                          key={id}
                          to="/book/$bookId"
                          params={{ bookId: ref.id }}
                          className="text-xs text-muted-foreground hover:text-accent"
                        >
                          {ref.title}
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Agreements" ? (
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {agreements.map((a) => (
                <li key={a.id} className="py-5">
                  <p className="font-serif text-lg leading-[1.45] text-foreground">
                    {a.claim}
                  </p>
                  <p className="mt-1.5 text-xs text-faint">
                    Independently supported in{" "}
                    {a.bookIds.map((id) => getBook(id)?.title).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Contradictions" ? (
            <div>
              {libraryContradictions.map((c) => (
                <ContradictionCard key={c.claim} item={c} />
              ))}
            </div>
          ) : null}

          {tab === "Open questions" ? (
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {openQuestions.map((q) => (
                <li key={q.id} className="flex items-baseline gap-3 py-4">
                  <span className="min-w-0 flex-1 font-serif text-base text-foreground">
                    {q.question}
                  </span>
                  <Link
                    to="/book/$bookId"
                    params={{ bookId: q.bookId }}
                    className="shrink-0 text-xs text-muted-foreground hover:text-accent"
                  >
                    {getBook(q.bookId)?.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-14">
          <SectionTitle aside={<span className="text-xs text-faint">Cross-book</span>}>
            Recent synthesis
          </SectionTitle>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {librarySynthesis.map((s) => {
              const answer = answers.find((a) => a.id === s.answerId);
              const open = openSynthesis === s.id;
              return (
                <li key={s.id} className="py-5">
                  <button
                    onClick={() => setOpenSynthesis(open ? null : s.id)}
                    className="w-full text-left"
                  >
                    <p className="font-serif text-lg leading-[1.4] text-foreground">
                      {s.question}
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {s.conclusion}
                    </p>
                    <p className="mt-1.5 text-xs text-faint">
                      {s.bookCount} books · {s.sources} passages ·{" "}
                      {open ? "Hide" : "Show"} full synthesis
                    </p>
                  </button>
                  {open && answer ? (
                    <div className="mt-5 border-l-2 border-border pl-5">
                      <AnswerBlock answer={answer} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-14">
          <SectionTitle>Insights with their evidence</SectionTitle>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {insights.map((i) => (
              <li key={i.id} className="py-6">
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  {i.title}
                </h3>
                <p className="mt-1.5 max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                  {i.summary}
                </p>
                <p className="mt-3 border-l border-border pl-3 font-serif text-sm leading-[1.55] text-foreground">
                  {i.passage}
                </p>
                <p className="mt-2 pl-3 text-xs text-faint">
                  {getBook(i.bookId)?.title} · {i.chapter}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    How to read this claim:{" "}
                  </span>
                  {i.interpretation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Page>

      <AskPanel
        open={ask}
        onClose={() => setAsk(false)}
        contextDetail="All books"
        initialScope="library"
      />
    </AppShell>
  );
}
