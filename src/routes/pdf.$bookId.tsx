import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquareQuote,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { AskBody } from "@/components/app/AskPanel";
import { Button, IconButton } from "@/components/app/primitives";
import { getBookDetail, getPdfUrl, hasMarkdown } from "@/lib/books";
import type { Answer, Scope } from "@/lib/ask-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pdf/$bookId")({
  staleTime: 60_000,
  gcTime: 15 * 60_000,
  loader: async ({ params }) => {
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
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: PdfError,
  component: NativePdfViewer,
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

function NativePdfViewer() {
  const { book, url } = Route.useLoaderData();

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.0);
  const [pageInput, setPageInput] = useState<string>("1");

  // AI Ask Panel state
  const [ask, setAsk] = useState<boolean>(false);
  const [scope, setScope] = useState<Scope>("page");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Load PDF Document via PDF.js on client mount
  useEffect(() => {
    let active = true;

    async function initPdf() {
      try {
        setLoading(true);
        // Client-only dynamic import to ensure zero SSR build conflicts
        const pdfjs = await import("pdfjs-dist");
        
        // Configure worker using CDN fallback or local bundle
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!active) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setPageInput("1");
        setLoading(false);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (active) setLoading(false);
      }
    }

    initPdf();
    return () => {
      active = false;
    };
  }, [url]);

  // 2. Render Page to Canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      setRendering(true);
      const page = await pdfDoc.getPage(pageNum);

      // Fit to container width on mobile or apply user zoom scale
      const containerWidth = containerRef.current.clientWidth - (window.innerWidth < 640 ? 24 : 64);
      const unscaledViewport = page.getViewport({ scale: 1 });
      
      const autoScale = Math.min(Math.max(containerWidth / unscaledViewport.width, 0.5), 2.5);
      const effectiveScale = autoScale * scale;

      const viewport = page.getViewport({ scale: effectiveScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      setRendering(false);
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Page render error:", err);
      }
      setRendering(false);
    }
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // 3. Page Navigation
  const goToPage = (num: number) => {
    const target = Math.min(Math.max(num, 1), numPages);
    setPageNum(target);
    setPageInput(String(target));
  };

  // Keyboard navigation (Left/Right arrows)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") goToPage(pageNum - 1);
      if (e.key === "ArrowRight") goToPage(pageNum + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageNum, numPages]);

  // 4. Text Selection for AI Ask Context
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        return;
      }
      const text = sel.toString().trim();
      if (text.length > 3) {
        setSelectedText(text);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const openAskForSelection = () => {
    setScope("selection");
    setAsk(true);
  };

  const contextDetail = `${book.title} · page ${pageNum} of ${numPages || 1}`;

  return (
    <div className="flex h-[100dvh] flex-col bg-background select-text">
      {/* Header Bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link to="/book/$bookId" params={{ bookId: book.id }}>
            <IconButton label="Back to book">
              <ArrowLeft size={18} strokeWidth={1.75} />
            </IconButton>
          </Link>
          <div className="min-w-0 max-w-[200px] sm:max-w-xs">
            <p className="truncate text-xs sm:text-sm font-medium text-foreground">{book.title}</p>
            <p className="truncate text-2xs text-faint">PDF Reader · Page {pageNum} of {numPages || "…"}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-0.5 border border-border-subtle rounded-sm p-0.5 mr-1">
            <IconButton
              label="Zoom Out"
              onClick={() => setScale((s) => Math.max(s - 0.2, 0.6))}
              disabled={scale <= 0.6}
            >
              <Minus size={14} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              label="Reset Zoom"
              onClick={() => setScale(1.0)}
              disabled={scale === 1.0}
            >
              <RotateCcw size={12} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              label="Zoom In"
              onClick={() => setScale((s) => Math.min(s + 0.2, 2.0))}
              disabled={scale >= 2.0}
            >
              <Plus size={14} strokeWidth={1.75} />
            </IconButton>
          </div>

          {/* Switch to Markdown Reader if available */}
          {hasMarkdown(book) ? (
            <Link to="/read/$bookId" params={{ bookId: book.id }} search={{}}>
              <Button size="sm" variant="secondary" className="hidden sm:inline-flex gap-1.5 text-xs">
                <FileText size={14} strokeWidth={1.75} />
                Read text
              </Button>
            </Link>
          ) : null}

          {/* Ask AI Trigger Button */}
          <Button
            size="sm"
            variant={ask ? "primary" : "secondary"}
            onClick={() => setAsk((p) => !p)}
            className="gap-1.5 text-xs"
          >
            <MessageSquareQuote size={14} strokeWidth={1.75} />
            <span className="hidden xs:inline">Ask AI</span>
          </Button>
        </div>
      </header>

      {/* Main Reading Workspace + Ask Panel */}
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* PDF Canvas Viewport */}
        <main
          ref={containerRef}
          className={cn(
            "flex-1 overflow-auto flex flex-col items-center justify-start p-3 sm:p-6 bg-surface/50 transition-all",
            ask && "lg:mr-[420px]"
          )}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-accent" />
              <p className="text-sm">Loading {book.title}…</p>
            </div>
          ) : (
            <div className="relative shadow-md rounded-xs overflow-hidden border border-border-subtle bg-white">
              {rendering ? (
                <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <Loader2 size={20} className="animate-spin text-accent" />
                </div>
              ) : null}
              <canvas ref={canvasRef} className="block max-w-full" />
            </div>
          )}

          {/* Floating Selection Tooltip */}
          {selectedText && !ask ? (
            <div className="fixed bottom-20 z-30 animate-in fade-in slide-in-from-bottom-2">
              <Button
                size="sm"
                variant="primary"
                onClick={openAskForSelection}
                className="gap-1.5 shadow-lg border border-accent/20"
              >
                <MessageSquareQuote size={14} strokeWidth={1.75} />
                Ask AI about selected text
              </Button>
            </div>
          ) : null}
        </main>

        {/* Floating Page Navigation Bar */}
        {!loading && numPages > 0 ? (
          <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border shadow-md rounded-full px-3 py-1.5 text-xs">
            <IconButton
              label="Previous Page"
              onClick={() => goToPage(pageNum - 1)}
              disabled={pageNum <= 1}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </IconButton>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const p = parseInt(pageInput, 10);
                if (!isNaN(p)) goToPage(p);
              }}
              className="flex items-center gap-1 font-mono"
            >
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => setPageInput(String(pageNum))}
                className="w-10 text-center bg-surface border border-border-subtle rounded-xs px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-faint">/ {numPages}</span>
            </form>

            <IconButton
              label="Next Page"
              onClick={() => goToPage(pageNum + 1)}
              disabled={pageNum >= numPages}
            >
              <ChevronRight size={16} strokeWidth={2} />
            </IconButton>
          </nav>
        ) : null}

        {/* Integrated Ask AI Sidebar (Desktop & Mobile Slide-over) */}
        {ask ? (
          <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-border bg-background shadow-panel animate-in slide-in-from-right duration-200">
            <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquareQuote size={16} className="text-accent" />
                <span className="text-sm font-medium text-foreground">Ask AI</span>
              </div>
              <IconButton label="Close Ask panel" onClick={() => setAsk(false)}>
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              <AskBody
                scope={scope}
                setScope={setScope}
                contextDetail={contextDetail}
                {...(selectedText && scope === "selection" ? { contextPassage: selectedText } : {})}
                answer={answer}
                setAnswer={setAnswer}
                availableScopes={["selection", "page", "book", "library"]}
              />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
