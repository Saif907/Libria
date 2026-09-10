import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button, Page, PageHeader, SectionTitle } from "@/components/app/primitives";
import { getLibrary, titleAndAuthorFromId, type LibraryBook } from "@/lib/books";
import {
  cancelJobApi,
  pollJobApi,
  uploadBookApi,
  type IndexingJobResponse,
  type IndexingStage,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/import")({
  loader: () => getLibrary(),
  head: () => ({
    meta: [
      { title: "Import Book — Marginalia" },
      {
        name: "description",
        content:
          "Upload and index books in PDF or Markdown format into your personal RAG library.",
      },
      { property: "og:title", content: "Import Book — Marginalia" },
    ],
  }),
  component: ImportPage,
});

const PRESET_CATEGORIES = [
  { id: "productivity", label: "Productivity" },
  { id: "psychology", label: "Psychology" },
  { id: "career_business", label: "Career & Business" },
  { id: "decision_making", label: "Decision Making" },
  { id: "finance", label: "Finance" },
  { id: "spirituality_philosophy", label: "Spirituality & Philosophy" },
];

const STAGE_DESCRIPTIONS: Record<IndexingStage, string> = {
  queued: "Job queued in background task runner...",
  parsing_pdf: "Extracting structured text via IBM Docling...",
  storing: "Archiving file artifacts to Supabase Storage...",
  chunking: "Performing token-aware hierarchical chunking...",
  embedding: "Generating dense & BM25 sparse vectors and upserting to Qdrant...",
  indexed: "Ingestion complete and verified in catalog.",
  failed: "Ingestion failed.",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImportPage() {
  const existingBooks = Route.useLoaderData() as LibraryBook[];
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["productivity"]);
  const [description, setDescription] = useState("");

  // Ingestion mode: "index" (full Docling + Qdrant) vs "attach_only" (Supabase file only)
  const [ingestionMode, setIngestionMode] = useState<"index" | "attach_only">("index");

  // Job progress states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentJob, setCurrentJob] = useState<IndexingJobResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-detect existing book conflict
  const existingConflict = useMemo(() => {
    if (!title.trim()) return null;
    const authorPart = author.trim() && author !== "Unknown Author" ? author.trim() : "";
    const candidateSlug = slugify(authorPart ? `${title}_by_${authorPart}` : title);
    const titleSlug = slugify(title);

    return existingBooks.find(
      (b) =>
        b.id === candidateSlug ||
        b.id === titleSlug ||
        b.title.toLowerCase().trim() === title.toLowerCase().trim(),
    );
  }, [title, author, existingBooks]);

  // Handle file drop / selection
  const handleFileSelect = useCallback((selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "md" && ext !== "markdown") {
      setErrorMessage("Please upload a PDF (.pdf) or Markdown (.md) document.");
      return;
    }

    setErrorMessage(null);
    setFile(selectedFile);

    // Auto-populate Title & Author from filename
    const stem = selectedFile.name.replace(/\.[^/.]+$/, "");
    const parsed = titleAndAuthorFromId(stem);
    setTitle(parsed.title);
    if (parsed.author && parsed.author.toLowerCase() !== "unknown author") {
      setAuthor(parsed.author);
    } else {
      setAuthor("");
    }
  }, []);

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId],
    );
  };

  // Submit and start polling
  const handleStartIngestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setIsSubmitting(true);
    setIsCancelling(false);
    setErrorMessage(null);
    setCurrentJob(null);

    try {
      const modeToUse = existingConflict ? ingestionMode : "index";
      const forceReindex = existingConflict && modeToUse === "index";

      const uploadRes = await uploadBookApi({
        file,
        title: title.trim(),
        author: author.trim() || "Unknown Author",
        categories: selectedCategories.length ? selectedCategories : ["general"],
        description: description.trim(),
        mode: modeToUse,
        force_reindex: forceReindex,
      });

      // Poll until finished
      const pollInterval = setInterval(async () => {
        try {
          const job = await pollJobApi(uploadRes.job_id);
          setCurrentJob(job);

          if (job.status === "completed") {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setIsCancelling(false);
            // Invalidate React Query cache so library auto-updates
            queryClient.invalidateQueries({ queryKey: ["library"] });
          } else if (job.status === "cancelled") {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setIsCancelling(false);
          } else if (job.status === "failed") {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setIsCancelling(false);
            setErrorMessage(job.error_message || "Ingestion pipeline encountered an error.");
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          setIsSubmitting(false);
          setIsCancelling(false);
          setErrorMessage(pollErr.message || "Failed polling job status.");
        }
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      setIsCancelling(false);
      setErrorMessage(err.message || "Upload failed. Check server connection.");
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob || isCancelling) return;
    setIsCancelling(true);
    try {
      const updated = await cancelJobApi(currentJob.job_id);
      setCurrentJob(updated);
    } catch (err: any) {
      console.error("Failed to signal cancellation:", err);
      setIsCancelling(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTitle("");
    setAuthor("");
    setDescription("");
    setCurrentJob(null);
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsCancelling(false);
    setIngestionMode("index");
  };

  const isCompleted = currentJob?.status === "completed";
  const isCancelled = currentJob?.status === "cancelled";
  const isCancellingStage = currentJob?.status === "cancelling" || isCancelling;

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Import Book"
          meta="Add an ebook to your library, extract clean prose, and build a high-precision vector index."
        />

        <div className="max-w-2xl py-6">
          {/* Progress / Success / Cancelled View */}
          {(isSubmitting || isCompleted || isCancelled || isCancellingStage) && currentJob ? (
            <div className="space-y-6 rounded-md border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-foreground">
                    {isCompleted
                      ? "Ingestion Complete!"
                      : isCancelled
                        ? "Indexing Cancelled & Rolled Back"
                        : isCancellingStage
                          ? "Cancelling & Rolling Back..."
                          : "Processing Document..."}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Job ID: <span className="font-mono">{currentJob.job_id}</span>
                  </p>
                </div>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> Ready to Read
                  </span>
                ) : isCancelled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <XCircle size={14} /> Cancelled & Rolled Back
                  </span>
                ) : isCancellingStage ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Loader2 size={14} className="animate-spin" /> Rolling Back...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    <Loader2 size={14} className="animate-spin" /> In Progress
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {isCancelled
                      ? "Indexing was aborted. Any uncommitted data has been rolled back."
                      : isCancellingStage
                        ? "Purging uncommitted vector embeddings from Qdrant Cloud..."
                        : STAGE_DESCRIPTIONS[currentJob.current_stage] || currentJob.current_stage}
                  </span>
                  <span className="font-medium text-foreground">
                    {isCancelled ? 0 : currentJob.progress_percent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 ease-out",
                      isCompleted
                        ? "bg-emerald-500"
                        : isCancelled
                          ? "bg-muted-foreground/30"
                          : isCancellingStage
                            ? "bg-amber-500 animate-pulse"
                            : "bg-accent",
                    )}
                    style={{
                      width: isCancelled
                        ? "0%"
                        : `${Math.max(currentJob.progress_percent, 5)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Cancellation Guarantee Notice */}
              {isCancelled && (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-medium text-foreground">Zero Partial Indexing Guarantee</p>
                      <p className="mt-1 text-muted-foreground leading-relaxed">
                        The indexing pipeline aborted immediately. Any uncommitted vector embeddings generated during this run were automatically deleted from Qdrant Cloud. Your existing catalog and prior book versions remain 100% intact.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Completed Metrics Summary */}
              {isCompleted && (
                <div className="grid grid-cols-3 gap-3 rounded-sm border border-border bg-reading p-3.5 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">Version</div>
                    <div className="mt-0.5 font-mono font-medium text-foreground">
                      v{currentJob.version}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Chunks Indexed</div>
                    <div className="mt-0.5 font-mono font-medium text-foreground">
                      {currentJob.chunks_indexed} chunks
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="mt-0.5 font-mono font-medium text-foreground">
                      {currentJob.elapsed_seconds ? `${currentJob.elapsed_seconds}s` : "Instant"}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                {isCompleted ? (
                  <>
                    <div />
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" onClick={handleReset}>
                        Import Another
                      </Button>
                      <Link to="/book/$bookId" params={{ bookId: currentJob.book_id }}>
                        <Button variant="primary">
                          <BookOpen size={14} /> Open Book
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : isCancelled ? (
                  <>
                    <div />
                    <Button variant="outline" onClick={handleReset}>
                      <RefreshCw size={13} className="mr-1.5" /> Import Again
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {isCancellingStage
                        ? "Aborting pipeline and cleaning up vectors..."
                        : "You can safely stay on this page or cancel at any time."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelJob}
                      disabled={isCancellingStage}
                      className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                    >
                      {isCancellingStage ? (
                        <>
                          <Loader2 size={13} className="mr-1.5 animate-spin" /> Cancelling...
                        </>
                      ) : (
                        <>
                          <XCircle size={13} className="mr-1.5" /> Cancel Indexing
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Upload & Ingestion Form */
            <form onSubmit={handleStartIngestion} className="space-y-6">
              {/* File Dropzone */}
              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md border-2 border-dashed p-10 text-center transition-colors duration-150 cursor-pointer",
                    isDragging
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/60 bg-reading",
                  )}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf,.md,.markdown";
                    input.onchange = (e: any) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    };
                    input.click();
                  }}
                >
                  <div className="rounded-full bg-surface p-3 text-muted-foreground border border-border shadow-2xs">
                    <UploadCloud size={24} strokeWidth={1.75} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Drop your PDF or Markdown file here
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supports <span className="font-mono">.pdf</span> (Docling parser) and{" "}
                    <span className="font-mono">.md</span> (direct ingestion)
                  </p>
                </div>
              ) : (
                /* Selected File Card */
                <div className="flex items-center justify-between rounded-md border border-border bg-reading p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-accent/10 text-accent font-mono text-xs font-semibold">
                      {file.name.endsWith(".pdf") ? "PDF" : "MD"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    aria-label="Remove file"
                    className="rounded-sm p-1.5 text-faint hover:text-foreground transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Conflict / Smart Option 3 Card */}
              {file && existingConflict && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                    <AlertCircle size={15} />
                    <span>Existing Book Detected: "{existingConflict.title}"</span>
                  </div>
                  <p className="text-muted-foreground">
                    This book is already indexed in your library. How would you like to handle this
                    upload?
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    {/* Mode A: Attach Only */}
                    <div
                      onClick={() => setIngestionMode("attach_only")}
                      className={cn(
                        "cursor-pointer rounded-sm border p-3 transition-all",
                        ingestionMode === "attach_only"
                          ? "border-accent bg-surface shadow-2xs text-foreground"
                          : "border-border/60 bg-transparent text-muted-foreground hover:border-border",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Paperclip size={14} className="text-accent" />
                        <span>Attach File Only</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Uploads file to storage for reading. Keeps existing verified vectors.
                        <strong> $0 cost, instant.</strong>
                      </p>
                    </div>

                    {/* Mode B: Full Reindex */}
                    <div
                      onClick={() => setIngestionMode("index")}
                      className={cn(
                        "cursor-pointer rounded-sm border p-3 transition-all",
                        ingestionMode === "index"
                          ? "border-accent bg-surface shadow-2xs text-foreground"
                          : "border-border/60 bg-transparent text-muted-foreground hover:border-border",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <RefreshCw size={14} className="text-accent" />
                        <span>Re-index (v2)</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Re-extracts text via Docling and updates vector index. Purges v1 vectors
                        atomically.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata Fields */}
              {file && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Book Title
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. The Charisma Myth"
                      className="w-full rounded-sm border border-border bg-reading px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Author(s)
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="e.g. Olivia Fox Cabane"
                      className="w-full rounded-sm border border-border bg-reading px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Categories
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_CATEGORIES.map((cat) => {
                        const active = selectedCategories.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleCategory(cat.id)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs transition-colors",
                              active
                                ? "border-accent bg-accent text-accent-foreground font-medium"
                                : "border-border bg-reading text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Short Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Key themes or takeaways from this book..."
                      className="w-full resize-none rounded-sm border border-border bg-reading px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-sm border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              {file && (
                <div className="flex justify-end pt-2">
                  <Button variant="primary" type="submit" disabled={!title.trim() || isSubmitting}>
                    <Sparkles size={14} />
                    {existingConflict && ingestionMode === "attach_only"
                      ? "Attach to Library"
                      : "Start Ingestion & Indexing"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>
      </Page>
    </AppShell>
  );
}
