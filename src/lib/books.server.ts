/**
 * Turns Supabase bucket objects into the book domain the UI renders.
 *
 * SERVER ONLY — imported dynamically from inside the server-function handlers in
 * books.ts, so neither this module nor supabase-storage.server.ts enters the client bundle.
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
import {
  downloadText,
  loadCatalog,
  signedObjectUrl,
  supabaseStorageConfig,
  type CatalogBook,
} from "./supabase-storage.server";

/** Long enough that browsing costs nothing, short enough to notice an upload. */
const LIBRARY_TTL_MS = 5 * 60 * 1000;

/** A parsed book is ~1 MB of text; three is a comfortable working set. */
const PARSED_BOOK_CACHE_SIZE = 3;

/**
 * Rough bytes-per-word for markdown prose (≈5 letters, a space, plus syntax).
 * Only used for the library listing reading-time estimation.
 */
const BYTES_PER_WORD = 6.5;

/** Above this, a chapter is subdivided so the reader never renders a huge blob. */
const MAX_CHAPTER_WORDS = 6000;
const TARGET_SPLIT_WORDS = 3000;

/* ---------- Helpers ---------- */

function parseYear(publishedDate: string | undefined): number {
  const match = publishedDate?.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function catalogBookToLibraryBook(book: CatalogBook): LibraryBook {
  const fallback = titleAndAuthorFromId(book.id);
  const categories = (book.categories ?? []).filter(
    (category): category is string => typeof category === "string" && category !== "",
  );
  const firstCategory = categories[0];

  const estimatedMinutes = book.markdown_size_bytes
    ? Math.round(book.markdown_size_bytes / BYTES_PER_WORD / WORDS_PER_MINUTE)
    : 0;

  return {
    id: book.id,
    markdownObject: book.markdown_path,
    pdfObject: book.pdf_path,
    title: book.title?.trim() || fallback.title,
    author: book.author?.trim() || fallback.author,
    year: parseYear(book.published_date),
    collection: firstCategory ? categoryLabel(firstCategory) : "Uncategorised",
    categories,
    description: book.description?.trim() ?? "",
    cover: coverFor(book.id),
    sizeBytes: book.markdown_size_bytes || book.pdf_size_bytes || 0,
    estimatedMinutes,
    updated: book.updated_at ?? "",
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
 * Loads the library instantly in one single call via the master catalog.json file.
 */
async function fetchLibrary(): Promise<LibraryBook[]> {
  const { ownerUid } = supabaseStorageConfig();
  const catalog = await loadCatalog(ownerUid);

  if (!catalog || !Array.isArray(catalog.books)) {
    console.warn("No catalog.json found or catalog.books is empty.");
    return [];
  }

  return catalog.books
    .map(catalogBookToLibraryBook)
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function findBook(bookId: string): Promise<LibraryBook | undefined> {
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
    // Refresh LRU position
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

  // A PDF-only book has no chapters to parse — renders straight from metadata
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
const MIN_HEADINGS_FOR_LEVEL = 3;
const MIN_FRONT_MATTER_WORDS = 50;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

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
