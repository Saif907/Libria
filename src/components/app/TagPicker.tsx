import { useState, useMemo, useRef, useEffect } from "react";
import { type LibraryBook } from "@/lib/books";
import { BookOpen, Hash, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagPickerProps {
  books: LibraryBook[];
  selectedBooks: string[]; // book ids
  onToggleBook: (bookId: string) => void;
  selectedCategories: string[]; // category strings
  onToggleCategory: (category: string) => void;
}

export function TagPickerPopover({
  open,
  mode,
  onClose,
  books,
  selectedBooks,
  onToggleBook,
  selectedCategories,
  onToggleCategory,
}: TagPickerProps & {
  open: boolean;
  mode: "books" | "categories";
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  // Derived unique categories across all library books
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const b of books) {
      if (b.collection) cats.add(b.collection);
      if (Array.isArray(b.categories)) {
        for (const c of b.categories) cats.add(c);
      }
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [books]);

  // Filtered books
  const filteredBooks = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.collection?.toLowerCase().includes(q)
    );
  }, [books, query]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allCategories;
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, query]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-72 sm:w-80 max-w-[calc(100vw-24px)] rounded-sm border border-border bg-background shadow-dialog p-2 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border-subtle mb-1.5">
        {mode === "books" ? (
          <BookOpen size={13} className="text-accent shrink-0" />
        ) : (
          <Hash size={13} className="text-accent shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "books" ? "Search books to tag..." : "Search categories..."}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none py-0.5"
        />
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
        >
          <X size={12} />
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {mode === "books" ? (
          filteredBooks.length === 0 ? (
            <p className="text-2xs text-muted-foreground text-center py-3">No matching books found</p>
          ) : (
            filteredBooks.map((b) => {
              const isSelected = selectedBooks.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onToggleBook(b.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xs text-left text-xs transition-colors",
                    isSelected
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-foreground hover:bg-surface"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.title}</p>
                    <p className="truncate text-2xs text-muted-foreground">{b.author}</p>
                  </div>
                  {isSelected && <Check size={12} className="shrink-0 text-accent" />}
                </button>
              );
            })
          )
        ) : filteredCategories.length === 0 ? (
          <p className="text-2xs text-muted-foreground text-center py-3">No matching categories found</p>
        ) : (
          filteredCategories.map((c) => {
            const isSelected = selectedCategories.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => onToggleCategory(c)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xs text-left text-xs transition-colors capitalize",
                  isSelected
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-foreground hover:bg-surface"
                )}
              >
                <span className="truncate">#{c.replace(/_/g, " ")}</span>
                {isSelected && <Check size={12} className="shrink-0 text-accent" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
