import { createServerFn } from "@tanstack/react-start";

/* ---------- Domain types ---------- */

/** A chapter's shape matches what the existing UI already renders. */
export type BookChapter = {
  id: string;
  title: string;
  words: number;
};

export type BookCoverStyle = {
  bg: string;
  fg: string;
  rule: boolean;
};

/**
 * One book in the library. `id` is the lowercased filename stem, the same key
 * the backend's GCSStreamer uses, so a book means the same thing on both sides.
 *
 * A book is in the library if *either* format exists. The two object names are
 * the single source of truth for which formats are available — see `hasMarkdown`
 * and `hasPdf` rather than testing them inline.
 */
export type LibraryBook = {
  id: string;
  /** Full object path of the converted markdown, or null if never converted. */
  markdownObject: string | null;
  /** Full object path of the original PDF, or null if only markdown exists. */
  pdfObject: string | null;
  title: string;
  author: string;
  /** 0 when the manifest carries no publication date. */
  year: number;
  /** Primary category, as a display label. */
  collection: string;
  categories: string[];
  description: string;
  cover: BookCoverStyle;
  sizeBytes: number;
  /**
   * Estimated from the markdown's object size. 0 for a PDF-only book, where
   * there is no honest way to guess — page count and prose density are not in
   * the listing, so nothing is shown rather than a fabricated number.
   */
  estimatedMinutes: number;
  /** RFC 3339 timestamp of the newest of the two objects, or "". */
  updated: string;
};

/** Readable in the UI, and keeps the null-checks in exactly one place. */
export const hasMarkdown = (book: LibraryBook): boolean => book.markdownObject !== null;
export const hasPdf = (book: LibraryBook): boolean => book.pdfObject !== null;

export type BookDetail = {
  book: LibraryBook;
  chapters: BookChapter[];
  /** Real total, counted once the markdown is loaded. */
  totalWords: number;
};

export type ChapterContent = {
  index: number;
  title: string;
  markdown: string;
  words: number;
};

/* ---------- Category labels ---------- */

/**
 * Exact labels for the categories used in book_categories.json. Anything new
 * falls back to title case so an added category still renders sensibly.
 */
const CATEGORY_LABELS: Record<string, string> = {
  career_business: "Career & Business",
  decision_making: "Decision Making",
  finance: "Finance",
  productivity: "Productivity",
  psychology: "Psychology",
  spirituality_philosophy: "Spirituality & Philosophy",
};

export function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

/* ---------- Titles derived from filenames ---------- */

/** Words that stay lowercase inside a title, but not in first position. */
const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function titleCase(value: string): string {
  const words = value.split(/[-_\s]+/).filter(Boolean);
  return words
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/**
 * Falls back to the `<title>_by_<author>` filename convention when the manifest
 * has no entry, so a freshly uploaded book still shows up with a real name.
 */
export function titleAndAuthorFromId(id: string): { title: string; author: string } {
  const separator = id.lastIndexOf("_by_");
  if (separator === -1) return { title: titleCase(id), author: "Unknown author" };
  return {
    title: titleCase(id.slice(0, separator)),
    author: titleCase(id.slice(separator + 4)),
  };
}

/* ---------- Covers ---------- */

/**
 * There is no cover art in the bucket, so each book gets a stable colourway
 * picked by hashing its id. Same book, same cover, every render — chosen from a
 * fixed set rather than generated, so nothing comes out muddy.
 */
const COVER_PALETTE: BookCoverStyle[] = [
  { bg: "oklch(0.44 0.05 158)", fg: "oklch(0.96 0.01 90)", rule: true },
  { bg: "oklch(0.28 0.01 85)", fg: "oklch(0.94 0.02 92)", rule: false },
  { bg: "oklch(0.35 0.03 250)", fg: "oklch(0.95 0.01 90)", rule: true },
  { bg: "oklch(0.5 0.09 61)", fg: "oklch(0.97 0.01 90)", rule: false },
  { bg: "oklch(0.93 0.03 92)", fg: "oklch(0.25 0.01 85)", rule: true },
  { bg: "oklch(0.46 0.08 24)", fg: "oklch(0.96 0.01 90)", rule: false },
  { bg: "oklch(0.62 0.06 200)", fg: "oklch(0.15 0.01 85)", rule: false },
  { bg: "oklch(0.33 0.02 120)", fg: "oklch(0.93 0.02 92)", rule: true },
  { bg: "oklch(0.38 0.06 300)", fg: "oklch(0.95 0.01 90)", rule: true },
  { bg: "oklch(0.52 0.07 145)", fg: "oklch(0.97 0.01 90)", rule: false },
];

export function coverFor(id: string): BookCoverStyle {
  // FNV-1a: tiny, well-distributed, and stable across runtimes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return COVER_PALETTE[hash % COVER_PALETTE.length]!;
}

/**
 * Every collection a book belongs to, as display labels. A book with no
 * categories still gets one label, so it remains reachable from the sidebar.
 */
export function collectionLabels(book: {
  categories: string[];
  collection: string;
}): string[] {
  return book.categories.length > 0 ? book.categories.map(categoryLabel) : [book.collection];
}

/* ---------- Formatting helpers ---------- */

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Average adult prose pace; used for every reading-time estimate. */
export const WORDS_PER_MINUTE = 220;

/* ---------- Server functions ---------- */

/**
 * `books.server.ts` is imported dynamically inside each handler so it never
 * enters the client module graph — the GCS credentials stay on the server.
 */

export const getLibrary = createServerFn({ method: "GET" }).handler(
  async (): Promise<LibraryBook[]> => {
    const { loadLibrary } = await import("./books.server");
    return loadLibrary();
  },
);

function parseBookId(input: unknown): { bookId: string } {
  const bookId = (input as { bookId?: unknown } | null)?.bookId;
  if (typeof bookId !== "string" || bookId === "") {
    throw new Error("bookId is required");
  }
  return { bookId };
}

export const getBookDetail = createServerFn({ method: "GET" })
  .inputValidator(parseBookId)
  .handler(async ({ data }): Promise<BookDetail | null> => {
    const { loadBookDetail } = await import("./books.server");
    return loadBookDetail(data.bookId);
  });

export const getChapterContent = createServerFn({ method: "GET" })
  .inputValidator((input: unknown): { bookId: string; index: number } => {
    const { bookId } = parseBookId(input);
    const rawIndex = (input as { index?: unknown }).index;
    const index = typeof rawIndex === "number" ? rawIndex : Number(rawIndex ?? 0);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("index must be a non-negative integer");
    }
    return { bookId, index };
  })
  .handler(async ({ data }): Promise<ChapterContent | null> => {
    const { loadChapterContent } = await import("./books.server");
    return loadChapterContent(data.bookId, data.index);
  });

/**
 * A short-lived URL the browser can stream the PDF from directly. Null when the
 * book has no PDF. The URL is the only thing that crosses to the client — the
 * credentials that signed it never leave the server.
 */
export const getPdfUrl = createServerFn({ method: "GET" })
  .inputValidator(parseBookId)
  .handler(async ({ data }): Promise<string | null> => {
    const { loadPdfUrl } = await import("./books.server");
    return loadPdfUrl(data.bookId);
  });
