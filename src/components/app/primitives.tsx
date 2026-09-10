import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "tertiary";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-dark border border-transparent",
  secondary:
    "bg-reading text-foreground border border-border hover:bg-hover",
  tertiary:
    "bg-transparent text-muted-foreground border border-transparent hover:bg-hover hover:text-foreground",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  label,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-hover hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Inputs ---------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="text-metadata">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-sm border border-border bg-reading px-2.5 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function SearchInput({
  className,
  large,
  ...props
}: ComponentProps<"input"> & { large?: boolean }) {
  return (
    <input
      type="search"
      className={cn(
        "w-full rounded-sm border border-border bg-reading text-foreground placeholder:text-faint focus:border-accent focus:outline-none",
        large ? "h-12 px-4 text-lg" : "h-9 px-2.5 text-sm",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Progress ---------- */

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn("h-[3px] w-full overflow-hidden rounded-xs bg-active", className)}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-accent transition-[width] duration-200 ease-out"
        style={{ width: `${Math.max(value * 100, value > 0 ? 2 : 0)}%` }}
      />
    </div>
  );
}

/* ---------- Book cover ---------- */

export function BookCover({
  book,
  width = 96,
  float = true,
  className,
}: {
  book: { title: string; author: string; cover: { bg: string; fg: string; rule?: boolean } };
  width?: number;
  float?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xs",
        float && "shadow-cover",
        className,
      )}
      style={{
        width,
        height: Math.round(width * 1.5),
        backgroundColor: book.cover.bg,
        color: book.cover.fg,
      }}
      aria-hidden
    >
      <div
        className="flex h-full flex-col justify-between"
        style={{ padding: Math.max(8, width * 0.1) }}
      >
        <div>
          {book.cover.rule ? (
            <div
              className="mb-2 h-px w-6 opacity-60"
              style={{ backgroundColor: book.cover.fg }}
            />
          ) : null}
          <div
            className="font-serif font-semibold leading-[1.2]"
            style={{ fontSize: Math.max(9, width * 0.125) }}
          >
            {book.title}
          </div>
        </div>
        <div
          className="opacity-70"
          style={{ fontSize: Math.max(7, width * 0.082) }}
        >
          {book.author}
        </div>
      </div>
    </div>
  );
}

/* ---------- Page structure ---------- */

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 sm:mb-8 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.015em] text-foreground">
          {title}
        </h1>
        {meta ? (
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Page({
  children,
  width = "page",
}: {
  children: ReactNode;
  width?: "page" | "answer";
}) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-6 sm:px-10 sm:py-10",
        width === "page" ? "max-w-[1240px]" : "max-w-[900px]",
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function EmptyState({
  line,
  explanation,
  action,
}: {
  line: string;
  explanation: string;
  action?: ReactNode;
}) {
  return (
    <div className="max-w-md border-t border-border-subtle py-10">
      <p className="text-lg font-medium text-foreground">{line}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{explanation}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ---------- Source reference ---------- */

export function SourceReference({
  bookId,
  bookTitle,
  chapter,
}: {
  bookId: string;
  bookTitle: string;
  chapter: string;
}) {
  return (
    <Link
      to="/read/$bookId"
      params={{ bookId }}
      className="group inline-flex items-baseline gap-1.5 text-xs text-muted-foreground transition-colors hover:text-accent"
    >
      <span className="font-medium text-foreground group-hover:text-accent">
        {bookTitle}
      </span>
      <span aria-hidden>·</span>
      <span>{chapter}</span>
      <span className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
        →
      </span>
    </Link>
  );
}

/* ---------- Tabs (text-led) ---------- */

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex gap-6 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors duration-150",
            active === t
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
