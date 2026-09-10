import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AskBody, type AttachedPageContext } from "@/components/app/AskPanel";
import { Button, IconButton } from "@/components/app/primitives";
import { getBookDetail, getPdfUrl, hasMarkdown } from "@/lib/books";
import type { Answer, Scope } from "@/lib/ask-data";
import { cn } from "@/lib/utils";
import { useResizableSidebar, SidebarResizeHandle } from "@/hooks/use-resizable-sidebar";

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
  component: ContinuousPdfViewer,
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

/**
 * Individual Page Item with IntersectionObserver lazy-rendering.
 * Unrendered pages maintain exact aspect-ratio placeholders so the scrollbar remains 100% accurate.
 */
const LazyPdfPage = memo(function LazyPdfPage({
  pdfDoc,
  pdfjs,
  pageNumber,
  baseWidth,
  scale,
  aspectRatio,
  onVisible,
  onSelectPage,
  isSelected,
}: {
  pdfDoc: any;
  pdfjs: any;
  pageNumber: number;
  baseWidth: number;
  scale: number;
  aspectRatio: number;
  onVisible: (page: number) => void;
  onSelectPage?: (pageNumber: number, canvas: HTMLCanvasElement) => void;
  isSelected?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const textLayerTaskRef = useRef<any>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [rendered, setRendered] = useState(false);

  // Hold / Long-press detection (450ms press without scrolling)
  const longPressTimerRef = useRef<any>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleHoldTrigger = useCallback(() => {
    if (!canvasRef.current || !onSelectPage) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(40);
    }
    onSelectPage(pageNumber, canvasRef.current);
  }, [pageNumber, onSelectPage]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      handleHoldTrigger();
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    // Cancel hold if user is scrolling (moved finger > 12px)
    if (dx > 12 || dy > 12) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPos.current = null;
  };

  // IntersectionObserver to render only when within 400px of viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRender(true);
            // If the page is significantly in the center of view, set active
            if (entry.intersectionRatio > 0.4) {
              onVisible(pageNumber);
            }
          } else {
            // Keep memory low: unmount canvas when far out of view (>1200px)
            if (entry.boundingClientRect.top < -1500 || entry.boundingClientRect.top > 2500) {
              setShouldRender(false);
              setRendered(false);
            }
          }
        }
      },
      {
        rootMargin: "500px 0px 500px 0px",
        threshold: [0.1, 0.5, 0.8],
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  const targetWidth = Math.floor(baseWidth * scale);
  const targetHeight = Math.floor(targetWidth / (aspectRatio || 0.77));

  // Render to canvas and textLayer once shouldRender is true
  useEffect(() => {
    if (!shouldRender || !pdfDoc || !canvasRef.current) return;

    let isCurrent = true;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
        if (textLayerTaskRef.current) {
          try {
            textLayerTaskRef.current.cancel();
          } catch {}
          textLayerTaskRef.current = null;
        }

        const page = await pdfDoc.getPage(pageNumber);
        if (!isCurrent || !canvasRef.current) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const renderScale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const task = page.render({
          canvasContext: context,
          viewport,
        });
        renderTaskRef.current = task;
        await task.promise;
        if (!isCurrent) return;
        setRendered(true);

        // Render TextLayer for in-app native selection & copy
        if (pdfjs?.TextLayer && textLayerRef.current) {
          textLayerRef.current.replaceChildren();
          const textContentSource = page.streamTextContent
            ? page.streamTextContent()
            : await page.getTextContent();

          const textLayer = new pdfjs.TextLayer({
            textContentSource,
            container: textLayerRef.current,
            viewport,
          });
          textLayerTaskRef.current = textLayer;
          await textLayer.render();
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException" && err?.name !== "AbortException") {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    }

    renderPage();
    return () => {
      isCurrent = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      if (textLayerTaskRef.current) {
        try {
          textLayerTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [shouldRender, pdfDoc, pdfjs, pageNumber, targetWidth]);

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      style={{ width: `${targetWidth}px`, minHeight: `${targetHeight}px` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={cn(
        "relative mx-auto my-3 sm:my-5 rounded-xs shadow-md border bg-white overflow-hidden transition-all select-text group",
        isSelected
          ? "border-accent ring-2 ring-accent/60 shadow-lg"
          : "border-border-subtle hover:border-accent/40"
      )}
    >
      {/* Floating Page Quick-Action Pill (Hover on desktop, or easily tapped) */}
      {rendered ? (
        <div className="absolute top-2.5 right-2.5 z-10 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHoldTrigger();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium shadow-md backdrop-blur-sm transition-all cursor-pointer",
              isSelected
                ? "bg-accent text-accent-foreground ring-1 ring-accent"
                : "bg-background/90 text-foreground border border-border hover:bg-accent hover:text-accent-foreground"
            )}
            title={`Ask AI about Page ${pageNumber}`}
          >
            <Sparkles size={11} className={isSelected ? "fill-current" : "text-accent"} />
            <span>{isSelected ? `Page ${pageNumber} Attached` : `Ask Page ${pageNumber}`}</span>
          </button>
        </div>
      ) : null}

      {shouldRender ? (
        <>
          <canvas ref={canvasRef} className="block w-full h-auto pointer-events-none select-none" />
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 select-text pointer-events-auto"
          />
        </>
      ) : null}

      {!rendered ? (
        <div
          style={{ height: `${targetHeight}px` }}
          className="flex flex-col items-center justify-center text-muted-foreground/50 text-xs bg-surface/30"
        >
          <Loader2 size={18} className="animate-spin text-accent mb-2" />
          <span>Page {pageNumber}</span>
        </div>
      ) : null}
    </div>
  );
});

function ContinuousPdfViewer() {
  const { book, url } = Route.useLoaderData();

  // Document state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(0.75); // standard letter/A4 portrait

  // Navigation & Scale state
  const [activePage, setActivePage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [scale, setScale] = useState<number>(1.0);
  const [baseWidth, setBaseWidth] = useState<number>(760);

  // AI Ask Panel state
  const [ask, setAsk] = useState<boolean>(false);
  const [scope, setScope] = useState<Scope>("page");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [attachedPage, setAttachedPage] = useState<AttachedPageContext | null>(null);

  // Capture whole page photo snapshot
  const handleSelectPage = useCallback(
    (pageNum: number, canvas: HTMLCanvasElement) => {
      try {
        const imageUrl = canvas.toDataURL("image/jpeg", 0.85);
        const pageCtx: AttachedPageContext = {
          pageNumber: pageNum,
          imageUrl,
          bookTitle: book.title,
          bookId: book.id,
        };
        setAttachedPage(pageCtx);
        setScope("page");
        setAsk(true);
        toast.success(`Attached Page ${pageNum} photo to Ask AI`);
      } catch (err) {
        console.error("Failed to capture page snapshot", err);
        toast.error("Could not capture page photo");
      }
    },
    [book.title, book.id]
  );

  const {
    isWide: isSidebarWide,
    isDragging: isSidebarDragging,
    handlePointerDown: handleSidebarResize,
    resetWidth: resetSidebarWidth,
    toggleWide: toggleSidebarWide,
    asideStyle,
  } = useResizableSidebar();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Initialize PDF.js
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        setLoading(true);
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!active) return;

        setPdfjsLib(pdfjs);
        setPdfDoc(doc);
        setNumPages(doc.numPages);

        // Inspect page 1 aspect ratio
        const firstPage = await doc.getPage(1);
        const vp = firstPage.getViewport({ scale: 1 });
        if (vp.width && vp.height) {
          setAspectRatio(vp.width / vp.height);
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [url]);

  // 2. Responsive Base Width calculation (Mobile = 100% width, Desktop = capped readable width)
  const updateLayoutWidth = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const windowWidth = window.innerWidth;
    const containerWidth = scrollContainerRef.current.clientWidth;

    if (windowWidth < 768) {
      // Mobile: Full width minus comfortable padding (16px on each side)
      setBaseWidth(Math.max(containerWidth - 24, 300));
    } else {
      // Desktop / PC: Cap width at readable standard book width (max 780px)
      setBaseWidth(Math.min(containerWidth - 80, 780));
    }
  }, []);

  useEffect(() => {
    updateLayoutWidth();
    const el = scrollContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      updateLayoutWidth();
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, [updateLayoutWidth]);

  // 3. Scroll to specific page
  const scrollToPage = (targetPage: number) => {
    const clamped = Math.min(Math.max(targetPage, 1), numPages);
    const el = document.getElementById(`pdf-page-${clamped}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActivePage(clamped);
      setPageInput(String(clamped));
    }
  };

  const handlePageVisible = useCallback((page: number) => {
    setActivePage(page);
    setPageInput(String(page));
  }, []);

  // 4. Capture Text Selection for AI Ask Context & Clipboard
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      setSelectedText(text.length > 1 ? text : null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const openAskForSelection = () => {
    setScope("selection");
    setAsk(true);
  };

  const contextDetail = `${book.title} · page ${activePage} of ${numPages || 1}`;

  return (
    <div className="flex h-[100dvh] flex-col bg-background select-text">
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2 sm:px-4 sm:py-2.5 z-20 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/book/$bookId" params={{ bookId: book.id }}>
            <IconButton label="Back to book">
              <ArrowLeft size={18} strokeWidth={1.75} />
            </IconButton>
          </Link>
          <div className="min-w-0 max-w-[180px] sm:max-w-xs">
            <p className="truncate text-xs sm:text-sm font-medium text-foreground">{book.title}</p>
            <p className="truncate text-2xs text-faint">
              Continuous Scroll · Page {activePage} of {numPages || "…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 border border-border-subtle rounded-sm p-0.5">
            <IconButton
              label="Zoom Out"
              onClick={() => setScale((s) => Math.max(Number((s - 0.15).toFixed(2)), 0.6))}
              disabled={scale <= 0.6}
            >
              <Minus size={13} strokeWidth={1.75} />
            </IconButton>
            <span className="text-2xs font-mono px-1.5 text-muted-foreground min-w-[36px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <IconButton
              label="Zoom In"
              onClick={() => setScale((s) => Math.min(Number((s + 0.15).toFixed(2)), 1.8))}
              disabled={scale >= 1.8}
            >
              <Plus size={13} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              label="Fit Normal"
              onClick={() => setScale(1.0)}
              disabled={scale === 1.0}
            >
              <RotateCcw size={12} strokeWidth={1.75} />
            </IconButton>
          </div>

          {/* Switch to Markdown Reader if available */}
          {hasMarkdown(book) ? (
            <Link to="/read/$bookId" params={{ bookId: book.id }} search={{}}>
              <Button size="sm" variant="secondary" className="hidden sm:inline-flex gap-1.5 text-xs">
                <FileText size={14} strokeWidth={1.75} />
                Text
              </Button>
            </Link>
          ) : null}

          {/* Ask AI Toggle */}
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

      {/* Main Workspace */}
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* Continuous Scroll Container */}
        <main
          ref={scrollContainerRef}
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-2 sm:p-6 bg-surface/50 flex flex-col items-center"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center my-auto py-20 gap-3 text-muted-foreground">
              <Loader2 size={26} className="animate-spin text-accent" />
              <p className="text-sm">Loading {book.title}…</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center pb-24">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <LazyPdfPage
                  key={pageNum}
                  pdfDoc={pdfDoc}
                  pdfjs={pdfjsLib}
                  pageNumber={pageNum}
                  baseWidth={baseWidth}
                  scale={scale}
                  aspectRatio={aspectRatio}
                  onVisible={handlePageVisible}
                  onSelectPage={handleSelectPage}
                  isSelected={attachedPage?.pageNumber === pageNum}
                />
              ))}
            </div>
          )}

          {/* Floating Selection Action Toolbar */}
          {selectedText && !ask ? (
            <div
              className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-1.5 rounded-sm border border-border bg-reading/95 backdrop-blur-sm p-1.5 shadow-panel">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={openAskForSelection}
                  className="gap-1.5 text-xs font-medium"
                >
                  <MessageSquareQuote size={14} strokeWidth={1.75} />
                  Ask AI
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(selectedText);
                    toast.success("Copied to clipboard");
                    setSelectedText(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy size={13} strokeWidth={1.75} />
                  Copy
                </Button>
                <IconButton
                  label="Dismiss selection"
                  onClick={() => {
                    setSelectedText(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                >
                  <X size={15} strokeWidth={1.75} />
                </IconButton>
              </div>
            </div>
          ) : null}

          {/* Floating Quick Navigation Pill - Centered directly over book area */}
          {!loading && numPages > 0 ? (
            <div className="sticky bottom-4 z-20 mt-auto flex justify-center pointer-events-none pb-2">
              <nav className="pointer-events-auto flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border shadow-lg rounded-full px-3 py-1.5 text-xs">
                <IconButton
                  label="Previous Page"
                  onClick={() => scrollToPage(activePage - 1)}
                  disabled={activePage <= 1}
                >
                  <ChevronUp size={16} strokeWidth={2} />
                </IconButton>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const p = parseInt(pageInput, 10);
                    if (!isNaN(p)) scrollToPage(p);
                  }}
                  className="flex items-center gap-1 font-mono"
                >
                  <input
                    type="text"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={() => setPageInput(String(activePage))}
                    className="w-10 text-center bg-surface border border-border-subtle rounded-xs px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-faint">/ {numPages}</span>
                </form>

                <IconButton
                  label="Next Page"
                  onClick={() => scrollToPage(activePage + 1)}
                  disabled={activePage >= numPages}
                >
                  <ChevronDown size={16} strokeWidth={2} />
                </IconButton>

                <div className="h-3.5 w-px bg-border-subtle mx-0.5" />

                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.querySelector(`#pdf-page-${activePage} canvas`) as HTMLCanvasElement | null;
                    if (canvas) {
                      handleSelectPage(activePage, canvas);
                    } else {
                      setScope("page");
                      setAsk(true);
                    }
                  }}
                  className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-accent font-medium transition-colors px-1 py-0.5 cursor-pointer"
                  title={`Ask about Page ${activePage}`}
                >
                  <Sparkles size={12} className="text-accent" />
                  <span className="hidden sm:inline">Ask Page {activePage}</span>
                </button>
              </nav>
            </div>
          ) : null}
        </main>

        {/* Integrated Ask AI Sidebar (Docked desktop flex column, mobile drawer) */}
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
                "fixed inset-y-0 right-0 z-50 flex w-full max-w-full sm:max-w-[420px] flex-col border-l border-border bg-background shadow-panel",
                "lg:relative lg:inset-auto lg:z-10 lg:h-full lg:shrink-0 lg:max-w-none lg:shadow-none",
                "transition-[width] duration-75 ease-out",
                isSidebarDragging && "select-none transition-none"
              )}
            >
              <SidebarResizeHandle
                onPointerDown={handleSidebarResize}
                onDoubleClick={resetSidebarWidth}
                isDragging={isSidebarDragging}
              />
              <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquareQuote size={16} className="text-accent" />
                  <span className="text-sm font-medium text-foreground">Ask AI</span>
                </div>
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
                  contextDetail={contextDetail}
                  {...(selectedText && scope === "selection" ? { contextPassage: selectedText } : {})}
                  attachedPage={attachedPage ?? undefined}
                  onClearPage={() => setAttachedPage(null)}
                  answer={answer}
                  setAnswer={setAnswer}
                  availableScopes={["selection", "page", "book", "library"]}
                />
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
