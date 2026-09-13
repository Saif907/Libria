import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  List,
  Loader2,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
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
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        const canVibrate = !(navigator as any).userActivation || (navigator as any).userActivation?.isActive;
        if (canVibrate) {
          navigator.vibrate(40);
        }
      } catch {
        // Safe fallback if blocked by browser activation policy
      }
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
      {/* Floating Page Quick-Action Pill (Always accessible on mobile, hover on desktop) */}
      {rendered ? (
        <div className="absolute top-2.5 right-2.5 z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHoldTrigger();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium shadow-md backdrop-blur-sm transition-all cursor-pointer active:scale-95",
              isSelected
                ? "bg-accent text-accent-foreground ring-1 ring-accent"
                : "bg-background/90 text-foreground border border-border hover:bg-accent hover:text-accent-foreground"
            )}
            title={isSelected ? `Deselect Page ${pageNumber}` : `Select Page ${pageNumber} for Ask AI`}
          >
            {isSelected ? (
              <Check size={11} strokeWidth={2.5} className="text-accent-foreground" />
            ) : (
              <Plus size={11} strokeWidth={2} className="text-accent" />
            )}
            <span>{isSelected ? `Page ${pageNumber} Selected` : `Select Page ${pageNumber}`}</span>
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

  // AI Ask Panel state (supports multi-page attachments)
  const [ask, setAsk] = useState<boolean>(false);
  const [scope, setScope] = useState<Scope>("page");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [attachedPages, setAttachedPages] = useState<AttachedPageContext[]>([]);

  // Keyword Search State
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [pdfMatches, setPdfMatches] = useState<{ pageNumber: number; snippet: string }[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showResultsList, setShowResultsList] = useState<boolean>(false);
  const pageTextCacheRef = useRef<Map<number, string>>(new Map());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Capture whole page snapshot (photo + text) and toggle in attached pages list
  const handleTogglePage = useCallback(
    async (pageNum: number, canvas?: HTMLCanvasElement | null) => {
      try {
        const isAlreadyAttached = attachedPages.some((p) => p.pageNumber === pageNum);
        if (isAlreadyAttached) {
          setAttachedPages((prev) => prev.filter((p) => p.pageNumber !== pageNum));
          toast.info(`Deselected Page ${pageNum}`);
          return;
        }

        let imageUrl = "";
        const targetCanvas =
          canvas ||
          (document.querySelector(`#pdf-page-${pageNum} canvas`) as HTMLCanvasElement | null);
        if (targetCanvas) {
          // Optimized compression for multimodal vision (lightweight base64)
          imageUrl = targetCanvas.toDataURL("image/jpeg", 0.78);
        }

        let extractedText: string | undefined = undefined;
        if (pdfDoc) {
          try {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const rawText = textContent.items
              .map((item: any) => item.str || "")
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();

            if (rawText.length > 0) {
              extractedText = rawText;
            }
          } catch (textErr) {
            console.warn("Could not extract page text from PDF", textErr);
          }
        }

        const pageCtx: AttachedPageContext = {
          pageNumber: pageNum,
          imageUrl,
          bookTitle: book.title,
          bookId: book.id,
          pageText: extractedText,
        };

        setAttachedPages((prev) => [...prev, pageCtx]);
        setScope("page");
        const nextCount = attachedPages.length + 1;
        toast.success(
          nextCount === 1
            ? `Page ${pageNum} selected for Ask AI`
            : `Added Page ${pageNum} (${nextCount} pages selected)`
        );
      } catch (err) {
        console.error("Failed to capture page snapshot", err);
        toast.error("Could not capture page photo");
      }
    },
    [attachedPages, book.title, book.id, pdfDoc]
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

  // Asynchronous PDF Text Search across pages
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2 || !pdfDoc) {
      setPdfMatches([]);
      setCurrentMatchIndex(0);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results: { pageNumber: number; snippet: string }[] = [];

        for (let p = 1; p <= numPages; p++) {
          if (cancelled) break;

          let text = pageTextCacheRef.current.get(p);
          if (!text) {
            try {
              const page = await pdfDoc.getPage(p);
              const content = await page.getTextContent();
              text = content.items
                .map((it: any) => it.str || "")
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
              pageTextCacheRef.current.set(p, text);
            } catch {
              text = "";
            }
          }

          const lower = text.toLowerCase();
          let pos = 0;
          while ((pos = lower.indexOf(q, pos)) !== -1) {
            const start = Math.max(0, pos - 50);
            const end = Math.min(text.length, pos + q.length + 50);
            let snippet = text.slice(start, end);
            if (start > 0) snippet = "…" + snippet;
            if (end < text.length) snippet = snippet + "…";

            results.push({
              pageNumber: p,
              snippet,
            });

            pos += Math.max(1, q.length);
            if (results.length >= 100) break;
          }

          if (results.length >= 100) break;
        }

        if (!cancelled) {
          setPdfMatches(results);
          setCurrentMatchIndex(0);
          setIsSearching(false);
          if (results.length > 0) {
            scrollToPage(results[0].pageNumber);
          }
        }
      } catch (err) {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, pdfDoc, numPages]);

  const handleNextMatch = () => {
    if (pdfMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % pdfMatches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToPage(pdfMatches[nextIdx].pageNumber);
  };

  const handlePrevMatch = () => {
    if (pdfMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + pdfMatches.length) % pdfMatches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToPage(pdfMatches[prevIdx].pageNumber);
  };

  const jumpToMatch = (idx: number) => {
    if (idx < 0 || idx >= pdfMatches.length) return;
    setCurrentMatchIndex(idx);
    scrollToPage(pdfMatches[idx].pageNumber);
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
          {/* Keyword Search Button */}
          <IconButton
            label={searchOpen ? "Close search (Esc)" : "Search in PDF (Ctrl+F)"}
            onClick={() => {
              setSearchOpen((s) => !s);
              if (!searchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 60);
              }
            }}
          >
            <Search size={17} strokeWidth={1.75} className={searchOpen ? "text-accent" : ""} />
          </IconButton>

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
            className="gap-1.5 text-xs relative"
          >
            <MessageSquareQuote size={14} strokeWidth={1.75} />
            <span className="hidden xs:inline">Ask AI</span>
            {attachedPages.length > 0 && !ask ? (
              <span className="rounded-full bg-accent text-accent-foreground font-mono text-[10px] px-1.5 py-0.2 min-w-[17px] text-center font-bold shadow-xs">
                {attachedPages.length}
              </span>
            ) : null}
          </Button>
        </div>
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
              placeholder="Search keyword or phrase in PDF…"
              className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-faint focus:outline-none"
            />
            {isSearching ? (
              <Loader2 size={13} className="animate-spin text-accent shrink-0" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentMatchIndex(0);
                  setPdfMatches([]);
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
                {isSearching
                  ? "Scanning pages…"
                  : pdfMatches.length > 0
                  ? `${currentMatchIndex + 1} of ${pdfMatches.length} (Page ${pdfMatches[currentMatchIndex]?.pageNumber})`
                  : "No matches"}
              </span>
            ) : null}

            <div className="flex items-center gap-0.5">
              <IconButton
                label="Previous match (Shift+Enter)"
                onClick={handlePrevMatch}
                disabled={pdfMatches.length === 0}
              >
                <ChevronUp size={15} />
              </IconButton>
              <IconButton
                label="Next match (Enter)"
                onClick={handleNextMatch}
                disabled={pdfMatches.length === 0}
              >
                <ChevronDown size={15} />
              </IconButton>
            </div>

            {pdfMatches.length > 0 ? (
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
      {searchOpen && showResultsList && pdfMatches.length > 0 ? (
        <div className="border-b border-border bg-background/95 backdrop-blur max-h-60 overflow-y-auto z-20 px-3 sm:px-6 py-2 divide-y divide-border-subtle shadow-md">
          {pdfMatches.map((m, idx) => (
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
                <span>Page {m.pageNumber}</span>
                <span className="font-mono text-faint">Match {idx + 1}</span>
              </div>
              <p className="text-foreground/80 line-clamp-2">
                {highlightMatchInSnippet(m.snippet, searchQuery)}
              </p>
            </button>
          ))}
        </div>
      ) : null}

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
                  onSelectPage={handleTogglePage}
                  isSelected={attachedPages.some((p) => p.pageNumber === pageNum)}
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
                    void handleTogglePage(activePage, canvas);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 text-2xs font-medium transition-colors px-2 py-0.5 rounded-full cursor-pointer",
                    attachedPages.some((p) => p.pageNumber === activePage)
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  )}
                  title={`Attach or detach Page ${activePage} for Ask AI`}
                >
                  {attachedPages.some((p) => p.pageNumber === activePage) ? (
                    <Check size={12} strokeWidth={2.5} className="text-accent" />
                  ) : (
                    <Plus size={12} strokeWidth={2} className="text-muted-foreground" />
                  )}
                  <span>
                    {attachedPages.some((p) => p.pageNumber === activePage)
                      ? `Page ${activePage}`
                      : `Select P.${activePage}`}
                  </span>
                  {attachedPages.length > 0 && (
                    <span className="rounded-full bg-accent text-accent-foreground font-mono text-[10px] px-1.5 py-0.2 min-w-[16px] text-center font-bold">
                      {attachedPages.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>
          ) : null}

          {/* Floating Multi-Page Action Dock (Seamless Mobile & Desktop Selection) */}
          {attachedPages.length > 0 && !ask ? (
            <div
              className={cn(
                "fixed left-1/2 -translate-x-1/2 z-35 w-[calc(100%-1.25rem)] max-w-md pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-3",
                selectedText ? "bottom-28 sm:bottom-32" : "bottom-16 sm:bottom-18"
              )}
            >
              <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-full border border-accent/40 bg-background/95 p-1.5 pl-3 shadow-2xl backdrop-blur-md ring-1 ring-accent/25">
                {/* Attached Page Chips & Count */}
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground shrink-0">
                    <Sparkles size={13} className="text-accent fill-accent" />
                    <span>{attachedPages.length}</span>
                    <span className="hidden xs:inline text-muted-foreground font-normal text-2xs">
                      {attachedPages.length === 1 ? "page" : "pages"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5 min-w-0">
                    {attachedPages
                      .slice()
                      .sort((a, b) => a.pageNumber - b.pageNumber)
                      .map((page) => (
                        <span
                          key={page.pageNumber}
                          className="inline-flex items-center gap-1 rounded-full bg-surface border border-border px-2 py-0.5 text-2xs font-mono text-muted-foreground shrink-0 hover:border-destructive/40 transition-colors"
                        >
                          <span>p.{page.pageNumber}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleTogglePage(page.pageNumber);
                            }}
                            className="hover:text-destructive text-muted-foreground/70 rounded-full transition-colors cursor-pointer"
                            title={`Deselect page ${page.pageNumber}`}
                          >
                            <X size={10} strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedPages([]);
                      toast.info("Cleared selected pages");
                    }}
                    className="px-2 py-1 text-2xs text-muted-foreground hover:text-foreground hover:bg-surface rounded-full transition-colors cursor-pointer"
                    title="Clear all selections"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScope("page");
                      setAsk(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Ask AI</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
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
                  activeBookId={book.id}
                  activeBookTitle={book.title}
                  {...(selectedText && scope === "selection" ? { contextPassage: selectedText } : {})}
                  attachedPages={attachedPages}
                  onClearPage={(pNum) => {
                    if (pNum) {
                      setAttachedPages((prev) => prev.filter((p) => p.pageNumber !== pNum));
                    } else {
                      setAttachedPages([]);
                    }
                  }}
                  onClearAllPages={() => setAttachedPages([])}
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
