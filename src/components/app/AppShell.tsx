import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LogOut,
  Pause,
  Play,
  Search,
  Settings,
  SkipForward,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { collectionLabels, getLibrary } from "@/lib/books";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { IconButton } from "./primitives";

const primaryNav = [
  { to: "/", label: "Library" },
  { to: "/continue", label: "Continue Reading" },
  { to: "/knowledge", label: "Knowledge" },
  { to: "/saved", label: "Saved" },
];

const secondaryNav = [
  { to: "/import", label: "Import" },
  { to: "/highlights", label: "Highlights" },
  { to: "/notes", label: "Notes" },
  { to: "/audio", label: "Audio" },
];

const mobileNav = [
  { to: "/", label: "Library" },
  { to: "/continue", label: "Continue" },
  { to: "/knowledge", label: "Knowledge" },
  { to: "/saved", label: "Saved" },
];

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("reader-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("reader-theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="block rounded-sm px-2.5 py-[7px] text-sm text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-foreground"
      activeProps={{
        className: "bg-active !text-accent font-medium",
      }}
    >
      {label}
    </Link>
  );
}

/**
 * Collections come from the categories in the library manifest. Shared query
 * key with the library route's own fetch, so navigating between pages does not
 * re-list the bucket.
 */
function useCollections(): string[] {
  const { data } = useQuery({
    queryKey: ["library"],
    queryFn: () => getLibrary(),
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const labels = new Set<string>();
    for (const book of data ?? []) {
      for (const label of collectionLabels(book)) labels.add(label);
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [data]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [playing, setPlaying] = useState(false);
  const { user } = useAuth();
  const collections = useCollections();

  // Derive display name and initials from the auth session.
  const displayName =
    user?.user_metadata?.full_name ?? user?.email ?? "User";
  const initials =
    displayName
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-border bg-background lg:flex">
        <div className="px-5 pt-6 pb-5">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-serif text-lg font-semibold tracking-[-0.01em] text-foreground">
              Marginalia
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-px">
            {primaryNav.map((i) => (
              <NavLink key={i.to} {...i} />
            ))}
          </div>

          <div className="my-4 border-t border-border-subtle" />

          <div className="space-y-px">
            {secondaryNav.map((i) => (
              <NavLink key={i.to} {...i} />
            ))}
          </div>

          {collections.length > 0 ? (
            <>
              <div className="my-4 border-t border-border-subtle" />

              <p className="px-2.5 pb-1.5 text-metadata">Collections</p>
              <div className="space-y-px">
                {collections.map((c) => (
                  <Link
                    key={c}
                    to="/"
                    search={{ collection: c }}
                    className="block rounded-sm px-2.5 py-[7px] text-sm text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-foreground"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </nav>

        <div className="border-t border-border-subtle px-3 py-3">
          <div className="flex items-center justify-between">
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-sm px-2.5 py-[7px] text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            >
              <Settings size={16} strokeWidth={1.75} />
              Settings
            </Link>
            <IconButton
              label={dark ? "Switch to light theme" : "Switch to dark theme"}
              onClick={toggle}
            >
              {dark ? (
                <Sun size={16} strokeWidth={1.75} />
              ) : (
                <Moon size={16} strokeWidth={1.75} />
              )}
            </IconButton>
          </div>
          <div className="mt-1 flex items-center gap-2.5 px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
              {initials}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {displayName}
            </span>
            <IconButton label="Sign out" onClick={handleSignOut}>
              <LogOut size={15} strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3 lg:hidden">
          <Link to="/" className="font-serif text-base font-semibold">
            Marginalia
          </Link>
          <div className="flex items-center gap-1">
            <IconButton label="Search" onClick={toggle}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <Link to="/search" aria-label="Search">
              <IconButton label="Search">
                <Search size={18} strokeWidth={1.75} />
              </IconButton>
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-32 lg:pb-20">{children}</main>
      </div>

      {/* Mini player */}
      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-border bg-surface lg:bottom-0 lg:left-[248px]">
        <div className="flex items-center gap-3 px-4 py-2 lg:px-6">
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-hover"
          >
            {playing ? (
              <Pause size={16} strokeWidth={2} />
            ) : (
              <Play size={16} strokeWidth={2} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                The Scout Mindset
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                Chapter 5 · Noticing Bias
              </span>
            </div>
            <div className="mt-1 h-[2px] w-full bg-active">
              <div className="h-full w-[38%] bg-accent" />
            </div>
          </div>
          <span className="hidden font-mono text-2xs text-faint sm:inline">
            12:04 / 31:48
          </span>
          <IconButton label="Skip forward 30 seconds">
            <SkipForward size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background lg:hidden">
        {mobileNav.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            activeOptions={{ exact: i.to === "/" }}
            className={cn(
              "flex-1 py-4 text-center text-xs font-medium text-muted-foreground",
              pathname === i.to && "text-accent",
            )}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
