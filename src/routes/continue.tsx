import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import {
  BookCover,
  Button,
  Page,
  PageHeader,
  ProgressBar,
} from "@/components/app/primitives";
import { continueReading } from "@/lib/library-data";

export const Route = createFileRoute("/continue")({
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
  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Continue Reading"
          meta="Pick up where you left off"
        />
        <ul className="divide-hairline border-t border-border-subtle">
          {continueReading.map((b) => (
            <li key={b.id} className="flex items-center gap-5 py-5">
              <Link to="/book/$bookId" params={{ bookId: b.id }}>
                <BookCover book={b} width={56} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/book/$bookId"
                  params={{ bookId: b.id }}
                  className="font-serif text-lg font-semibold text-foreground hover:text-accent"
                >
                  {b.title}
                </Link>
                <p className="text-sm text-muted-foreground">{b.chapter}</p>
                <div className="mt-2.5 max-w-sm">
                  <ProgressBar value={b.progress} />
                  <p className="text-metadata mt-1.5">
                    {Math.round(b.progress * 100)}% · last opened {b.lastOpened}
                  </p>
                </div>
              </div>
              <Link to="/read/$bookId" params={{ bookId: b.id }}>
                <Button variant="primary">Resume</Button>
              </Link>
            </li>
          ))}
        </ul>
      </Page>
    </AppShell>
  );
}
