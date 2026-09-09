import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Button, IconButton } from "@/components/app/primitives";
import { getBookDetail, getPdfUrl, hasMarkdown } from "@/lib/books";

export const Route = createFileRoute("/pdf/$bookId")({
  loader: async ({ params }) => {
    // Both resolve the book from the same cached listing, so this is two
    // in-process lookups plus one signature — no object is downloaded here.
    const [detail, url] = await Promise.all([
      getBookDetail({ data: { bookId: params.bookId } }),
      getPdfUrl({ data: { bookId: params.bookId } }),
    ]);
    if (!detail || !url) throw notFound();
    return { book: detail.book, url };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Unavailable — Marginalia" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.book.title} (PDF) — Marginalia`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Read the original PDF of ${loaderData.book.title} by ${loaderData.book.author}.`,
        },
        { property: "og:title", content: title },
        { property: "og:type", content: "article" },
        // A private library has nothing to gain from being indexed.
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: PdfError,
  component: PdfViewer,
});

function PdfError({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-2xl font-semibold text-foreground">
        Could not open the PDF
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Signing the download link failed. The message below says why.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-sm border border-border bg-surface p-4 text-xs leading-[1.6] text-muted-foreground">
        {error.message}
      </pre>
      <div className="mt-6">
        <Link to="/">
          <Button variant="primary">Back to library</Button>
        </Link>
      </div>
    </div>
  );
}

function PdfViewer() {
  const { book, url } = Route.useLoaderData();
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2.5">
        <Link to="/book/$bookId" params={{ bookId: book.id }}>
          <IconButton label="Back to book">
            <ArrowLeft size={18} strokeWidth={1.75} />
          </IconButton>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium text-foreground">{book.title}</p>
          <p className="truncate text-xs text-faint">Original PDF</p>
        </div>

        {/* Only offered when the conversion actually exists for this book. */}
        {hasMarkdown(book) ? (
          <Link to="/read/$bookId" params={{ bookId: book.id }} search={{}}>
            <Button size="sm" variant="secondary" className="gap-1.5">
              <FileText size={14} strokeWidth={1.75} />
              Read text
            </Button>
          </Link>
        ) : null}

        <a href={url} target="_blank" rel="noreferrer">
          <IconButton label="Open PDF in a new tab">
            <ExternalLink size={18} strokeWidth={1.75} />
          </IconButton>
        </a>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* A book-sized PDF takes a moment; the iframe is blank until it paints. */}
        {loaded ? null : (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Loading {book.title}…
          </p>
        )}
        {/*
         * The browser's built-in viewer, streaming the object straight from GCS
         * over range requests. Nothing here is bundled, and the first page
         * renders long before the whole file has arrived.
         */}
        <iframe
          src={url}
          title={`${book.title} — PDF`}
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
