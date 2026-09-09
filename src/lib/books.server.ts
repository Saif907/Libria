/**
 * Turns bucket objects into the book domain the UI renders.
 *
 * SERVER ONLY — imported dynamically from inside the server-function handlers in
 * books.ts, so neither this module nor gcs.server.ts enters the client bundle.
 */

import {
  WORDS_PER_MINUTE,
  categoryLabel,
  coverFor,
  titleAndAuthorFromId,
  type BookChapter,
  type BookDetail,
  type ChapterContent,
  type LibraryBook,
} from "./books";
import { downloadText, gcsConfig, listObjects, signedObjectUrl, type GcsObject } from "./gcs.server";

/** Same filename the backend's GCSStreamer reads its metadata from. */
const MANIFEST_FILENAME = "book_categories.json";

/** Long enough that browsing costs nothing, short enough to notice an upload. */
const LIBRARY_TTL_MS = 5 * 60 * 1000;

/** A parsed book is ~1 MB of text; three is a comfortable working set. */
const PARSED_BOOK_CACHE_SIZE = 3;

/**
 * Rough bytes-per-word for markdown prose (≈5 letters, a space, plus syntax).
 * Only used for the library listing, where downloading 17 books to count words
 * would cost far more than the estimate is worth.
 */
const BYTES_PER_WORD = 6.5;

/** Above this, a chapter is subdivided so the reader never renders a huge blob. */
const MAX_CHAPTER_WORDS = 6000;
const TARGET_SPLIT_WORDS = 3000;

/* ---------- Keys ---------- */

function basename(objectName: string): string {
  return objectName.slice(objectName.lastIndexOf("/") + 1);
}

/**
 * Mirrors GCSStreamer._normalize_key (`Path(key).stem.lower()`) so a book has
 * the same id on the frontend and in the vector store, and so the manifest's
 * `<name>.pdf` keys join to the bucket's `<name>.md` objects.
 */
function normalizeKey(objectName: string): string {
  const base = basename(objectName);
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).toLowerCase();
}

/* ---------- Manifest ---------- */

type ManifestEntry = {
  title?: string;
  author?: string;
  published_date?: string;
  format?: string;
  categories?: string[];
  description?: string;
};

async function loadManifest(prefix: string): Promise<Map<string, ManifestEntry>> {
  const lookup = new Map<string, ManifestEntry>();

  let raw: string | null;
  try {
    raw = await downloadText(`${prefix}/${MANIFEST_FILENAME}`);
  } catch (error) {
    // Metadata is an enhancement, not a requirement — filenames alone are
    // enough to show a library, so degrade instead of failing the page.
    console.warn(`Could not read ${MANIFEST_FILENAME}; falling back to filenames.`, error);
    return lookup;
  }
  if (raw === null) return lookup;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`${MANIFEST_FILENAME} is not valid JSON; falling back to filenames.`, error);
    return lookup;
  }
  if (typeof parsed !== "object" || parsed === null) return lookup;

  // Register under both the raw key and its normalized stem, so `.pdf` keys in
  // the manifest resolve for `.md` objects in the bucket.
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const entry = value as ManifestEntry;
    lookup.set(key, entry);
    lookup.set(normalizeKey(key), entry);
  }
  return lookup;
}

function parseYear(publishedDate: string | undefined): number {
  const match = publishedDate?.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

/**
 * The two objects that can back one book. Either may be absent: some books were
 * only ever converted to markdown, some only uploaded as PDF, most have both.
 */
type BookSources = { markdown?: GcsObject; pdf?: GcsObject };

function newerOf(a: GcsObject | undefined, b: GcsObject | undefined): string {
  const left = a?.updated ?? "";
  const right = b?.updated ?? "";
  return left > right ? left : right;
}

function toLibraryBook(
  id: string,
  sources: BookSources,
  manifest: Map<string, ManifestEntry>,
): LibraryBook {
  const primary = sources.markdown ?? sources.pdf;
  const entry =
    manifest.get(id) ??
    (primary ? manifest.get(basename(primary.name)) : undefined);
  const fallback = titleAndAuthorFromId(id);

  const categories = (entry?.categories ?? []).filter(
    (category): category is string => typeof category === "string" && category !== "",
  );
  const firstCategory = categories[0];

  // Only the markdown's size predicts reading time; a PDF's bytes are mostly
  // fonts and images, so guessing from them would be noise dressed as a number.
  const estimatedMinutes = sources.markdown
    ? Math.round(sources.markdown.sizeBytes / BYTES_PER_WORD / WORDS_PER_MINUTE)
    : 0;

  return {
    id,
    markdownObject: sources.markdown?.name ?? null,
    pdfObject: sources.pdf?.name ?? null,
    title: entry?.title?.trim() || fallback.title,
    author: entry?.author?.trim() || fallback.author,
    year: parseYear(entry?.published_date),
    collection: firstCategory ? categoryLabel(firstCategory) : "Uncategorised",
    categories,
    description: entry?.description?.trim() ?? "",
    cover: coverFor(id),
    sizeBytes: primary?.sizeBytes ?? 0,
    estimatedMinutes,
    updated: newerOf(sources.markdown, sources.pdf),
  };
}

/* ---------- Library ---------- */

type Cached<T> = { value: T; expiresAt: number };

let libraryCache: Cached<LibraryBook[]> | undefined;
let libraryInFlight: Promise<LibraryBook[]> | undefined;

export async function loadLibrary(): Promise<LibraryBook[]> {
  if (libraryCache && Date.now() < libraryCache.expiresAt) return libraryCache.value;

  libraryInFlight ??= fetchLibrary().finally(() => {
    libraryInFlight = undefined;
  });

  const value = await libraryInFlight;
  libraryCache = { value, expiresAt: Date.now() + LIBRARY_TTL_MS };
  return value;
}

/**
 * All three requests go out together. Discovering the PDFs therefore costs no
 * extra wall-clock time over listing the markdown alone — it is the same round
 * trip, in parallel.
 */
async function fetchLibrary(): Promise<LibraryBook[]> {
  const { prefix, pdfPrefix } = gcsConfig();

  const [markdownObjects, pdfObjects, manifest] = await Promise.all([
    listObjects(`${prefix}/`),
    // A missing or unreadable `ebooks/` prefix must not take the library down
    // with it: the PDFs are an alternative view, not the library itself.
    listObjects(`${pdfPrefix}/`).catch((error: unknown) => {
      console.warn(`Could not list ${pdfPrefix}/; PDF view will be unavailable.`, error);
      return [] as GcsObject[];
    }),
    loadManifest(prefix),
  ]);

  // Keyed by normalized stem, so `ebooks/atomic_habits.pdf` and
  // `outputs_md/.../atomic_habits.md` collapse into one book with two formats.
  const sources = new Map<string, BookSources>();

  const register = (object: GcsObject, format: "markdown" | "pdf") => {
    const id = normalizeKey(object.name);
    if (id === "") return;
    const existing = sources.get(id) ?? {};
    existing[format] = object;
    sources.set(id, existing);
  };

  for (const object of markdownObjects) {
    if (object.name.toLowerCase().endsWith(".md")) register(object, "markdown");
  }
  for (const object of pdfObjects) {
    if (object.name.toLowerCase().endsWith(".pdf")) register(object, "pdf");
  }

  return [...sources.entries()]
    .map(([id, formats]) => toLibraryBook(id, formats, manifest))
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function findBook(bookId: string): Promise<LibraryBook | undefined> {
  // Resolving through the listing means a client-supplied id never becomes part
  // of an object path — traversal outside the prefix is structurally impossible.
  return (await loadLibrary()).find((book) => book.id === bookId);
}

/* ---------- Book content ---------- */

type ParsedBook = {
  chapters: BookChapter[];
  /** Markdown body per chapter, index-aligned with `chapters`. */
  contents: string[];
  totalWords: number;
};

const parsedBooks = new Map<string, ParsedBook>();
const parsedInFlight = new Map<string, Promise<ParsedBook | null>>();

async function loadParsedBook(book: LibraryBook): Promise<ParsedBook | null> {
  const cached = parsedBooks.get(book.id);
  if (cached) {
    // Refresh LRU position.
    parsedBooks.delete(book.id);
    parsedBooks.set(book.id, cached);
    return cached;
  }

  let pending = parsedInFlight.get(book.id);
  if (!pending) {
    pending = downloadAndParse(book).finally(() => parsedInFlight.delete(book.id));
    parsedInFlight.set(book.id, pending);
  }

  const parsed = await pending;
  if (!parsed) return null;

  parsedBooks.set(book.id, parsed);
  if (parsedBooks.size > PARSED_BOOK_CACHE_SIZE) {
    const oldest = parsedBooks.keys().next().value;
    if (oldest !== undefined) parsedBooks.delete(oldest);
  }
  return parsed;
}

async function downloadAndParse(book: LibraryBook): Promise<ParsedBook | null> {
  if (book.markdownObject === null) return null;
  const markdown = await downloadText(book.markdownObject);
  return markdown === null ? null : splitChapters(markdown);
}

export async function loadBookDetail(bookId: string): Promise<BookDetail | null> {
  const book = await findBook(bookId);
  if (!book) return null;

  // A PDF-only book has no chapters to parse, and no megabyte to download for
  // the detail page — it renders straight from the listing.
  if (book.markdownObject === null) return { book, chapters: [], totalWords: 0 };

  const parsed = await loadParsedBook(book);
  if (!parsed) return null;

  return { book, chapters: parsed.chapters, totalWords: parsed.totalWords };
}

/** Null when the book has no PDF, so the caller can 404 rather than guess. */
export async function loadPdfUrl(bookId: string): Promise<string | null> {
  const book = await findBook(bookId);
  if (!book?.pdfObject) return null;
  return signedObjectUrl(book.pdfObject);
}

/**
 * `index` is clamped rather than rejected: a stored reading position can outlive
 * a re-conversion that changed the chapter count, and the last chapter is a far
 * better answer there than a 404.
 */
export async function loadChapterContent(
  bookId: string,
  index: number,
): Promise<ChapterContent | null> {
  const book = await findBook(bookId);
  if (!book) return null;

  const parsed = await loadParsedBook(book);
  if (!parsed || parsed.chapters.length === 0) return null;

  const resolved = Math.min(Math.max(index, 0), parsed.chapters.length - 1);
  const chapter = parsed.chapters[resolved]!;
  const markdown = parsed.contents[resolved] ?? "";

  return { index: resolved, title: chapter.title, markdown, words: chapter.words };
}

/* ---------- Chapter splitting ---------- */

const HEADING = /^(#{1,3})\s+(.*?)\s*#*$/;

/** A level needs this many headings before it is treated as the chapter level. */
const MIN_HEADINGS_FOR_LEVEL = 3;

/** Below this, leading text before the first heading is not worth its own entry. */
const MIN_FRONT_MATTER_WORDS = 50;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Docling emits ATX headings, but how many levels it finds varies per PDF. Pick
 * the shallowest level that actually divides the book, and fall back to a single
 * chapter for files with no headings at all.
 */
function splitChapters(rawMarkdown: string): ParsedBook {
  const lines = rawMarkdown.replace(/\r\n?/g, "\n").split("\n");

  const headings: { line: number; level: number; title: string }[] = [];
  const countsByLevel = new Map<number, number>();
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = HEADING.exec(line);
    if (!match) return;

    const level = match[1]!.length;
    const title = match[2]!.trim();
    if (title === "") return;

    headings.push({ line: index, level, title });
    countsByLevel.set(level, (countsByLevel.get(level) ?? 0) + 1);
  });

  const chapterLevel =
    [1, 2, 3].find((level) => (countsByLevel.get(level) ?? 0) >= MIN_HEADINGS_FOR_LEVEL) ??
    [1, 2, 3].find((level) => (countsByLevel.get(level) ?? 0) > 0);

  const sections: { title: string; body: string }[] = [];

  if (chapterLevel === undefined) {
    sections.push({ title: "Full text", body: lines.join("\n") });
  } else {
    const breaks = headings.filter((heading) => heading.level === chapterLevel);

    const firstBreak = breaks[0]!;
    const frontMatter = lines.slice(0, firstBreak.line).join("\n");
    if (countWords(frontMatter) >= MIN_FRONT_MATTER_WORDS) {
      sections.push({ title: "Front matter", body: frontMatter });
    }

    breaks.forEach((heading, position) => {
      const end = breaks[position + 1]?.line ?? lines.length;
      // Skip the heading line itself: the reader renders the title as its own
      // element, so leaving it in would print it twice.
      sections.push({ title: heading.title, body: lines.slice(heading.line + 1, end).join("\n") });
    });
  }

  const chapters: BookChapter[] = [];
  const contents: string[] = [];
  let totalWords = 0;

  for (const section of sections) {
    for (const part of subdivide(section)) {
      chapters.push({ id: `ch-${chapters.length + 1}`, title: part.title, words: part.words });
      contents.push(part.body);
      totalWords += part.words;
    }
  }

  return { chapters, contents, totalWords };
}

/**
 * Backstop for books where docling found few headings: a 200k-word "chapter"
 * would be unreadable and slow to render, so oversized sections are cut at
 * paragraph boundaries.
 */
function subdivide(section: { title: string; body: string }): {
  title: string;
  body: string;
  words: number;
}[] {
  const words = countWords(section.body);
  if (words <= MAX_CHAPTER_WORDS) {
    return [{ title: section.title, body: section.body, words }];
  }

  const parts: { title: string; body: string; words: number }[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const body = buffer.join("\n\n");
    parts.push({
      title: `${section.title} (${parts.length + 1})`,
      body,
      words: bufferWords,
    });
    buffer = [];
    bufferWords = 0;
  };

  for (const block of section.body.split(/\n{2,}/)) {
    const blockWords = countWords(block);
    if (blockWords === 0) continue;
    if (bufferWords > 0 && bufferWords + blockWords > TARGET_SPLIT_WORDS) flush();
    buffer.push(block);
    bufferWords += blockWords;
  }
  flush();

  return parts;
}
