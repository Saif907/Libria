import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode, type ComponentType } from "react";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronsUpDown,
  FileText,
  Headphones,
  Highlighter,
  Layers,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  Search,
  Settings,
  SkipForward,
  Sparkles,
  Sun,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { collectionLabels, getLibrary } from "@/lib/books";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { IconButton } from "./primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  badge?: string;
}

const primaryNav: NavItem[] = [
  { to: "/", label: "Library", icon: BookOpen },
  { to: "/chat", label: "Libria Agent", icon: Sparkles, badge: "AI" },
  { to: "/continue", label: "Continue Reading", icon: Bookmark },
  { to: "/knowledge", label: "Knowledge Hub", icon: Layers },
  { to: "/saved", label: "Saved Passages", icon: BookmarkCheck },
];

const secondaryNav: NavItem[] = [
  { to: "/import", label: "Import Books", icon: UploadCloud },
  { to: "/highlights", label: "Highlights", icon: Highlighter },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/audio", label: "Audio Player", icon: Headphones },
];

const mobileBottomTabs = [
  { to: "/", label: "Library", icon: BookOpen },
  { to: "/chat", label: "Agent", icon: Sparkles },
  { to: "/continue", label: "Continue", icon: Bookmark },
  { to: "/knowledge", label: "Knowledge", icon: Layers },
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

function NavLink({
  to,
  label,
  icon: Icon,
  badge,
  onClick,
}: NavItem & {
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-sm text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-foreground"
      activeProps={{
        className: "bg-active !text-accent font-medium",
      }}
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-accent/15 px-1.5 py-0.2 text-3xs font-mono font-medium text-accent">
          {badge}
        </span>
      ) : null}
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

export function AppShell({
  children,
  fullHeight = false,
}: {
  children: ReactNode;
  fullHeight?: boolean;
}) {
  const { dark, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullHeight = fullHeight || pathname === "/chat";
  const [playing, setPlaying] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { user } = useAuth();
  const collections = useCollections();

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

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
    <div
      className={cn(
        "flex bg-background",
        isFullHeight ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      )}
    >
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-border bg-background lg:flex">
        <div className="px-5 pt-6 pb-5">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-serif text-lg font-semibold tracking-[-0.01em] text-foreground">
              Libria
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-px">
            {primaryNav.map((i) => (
              <NavLink key={i.to} {...i} />
            ))}
          </div>

          <div className="space-y-px pt-4">
            {secondaryNav.map((i) => (
              <NavLink key={i.to} {...i} />
            ))}
          </div>

          {collections.length > 0 ? (
            <div className="pt-5">
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
            </div>
          ) : null}
        </nav>

        {/* Bottom User Account Section: Unified access to Settings, Theme, and Logout */}
        <div className="p-3 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-hover cursor-pointer outline-none focus:bg-hover select-none"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium text-foreground">
                  {initials}
                </span>
                <div className="min-w-0 flex-1 truncate">
                  <p className="truncate text-xs font-medium text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-2xs text-muted-foreground">
                    {user?.email || "Account"}
                  </p>
                </div>
                <ChevronsUpDown
                  size={14}
                  className="shrink-0 text-faint transition-colors group-hover:text-foreground"
                />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="start"
              className="w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-dialog"
            >
              <DropdownMenuLabel className="px-2.5 py-2 text-2xs font-normal">
                <p className="font-medium text-xs text-foreground truncate">{displayName}</p>
                <p className="truncate text-muted-foreground mt-0.5">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-border-subtle" />

              <DropdownMenuItem asChild>
                <Link
                  to="/settings"
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-hover hover:text-accent outline-none"
                >
                  <Settings size={14} strokeWidth={1.75} />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={toggle}
                className="flex cursor-pointer items-center justify-between rounded-sm px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-hover hover:text-accent outline-none"
              >
                <div className="flex items-center gap-2">
                  {dark ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
                  <span>Theme</span>
                </div>
                <span className="text-2xs text-muted-foreground font-mono">
                  {dark ? "Dark" : "Light"}
                </span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border-subtle" />

              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10 outline-none"
              >
                <LogOut size={14} strokeWidth={1.75} />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col lg:pl-[248px]",
          isFullHeight && "h-[100dvh] overflow-hidden"
        )}
      >
        {/* Mobile Header (Suppressed on workspace routes like /chat which feature their own specialized header) */}
        {!isFullHeight ? (
          <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5 lg:hidden bg-background/90 backdrop-blur z-20">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open navigation menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground transition-colors active:scale-95"
              >
                <Menu size={20} strokeWidth={1.75} />
              </button>
              <Link to="/" className="font-serif text-base font-semibold tracking-tight text-foreground">
                Libria
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Toggle theme" onClick={toggle}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
              <Link to="/search" aria-label="Search library">
                <IconButton label="Search">
                  <Search size={18} strokeWidth={1.75} />
                </IconButton>
              </Link>
            </div>
          </header>
        ) : null}

        <main
          className={cn(
            "flex-1",
            isFullHeight
              ? "min-h-0 h-full overflow-hidden flex flex-col pb-0"
              : playing
              ? "pb-36 lg:pb-20"
              : "pb-20 lg:pb-8"
          )}
        >
          {children}
        </main>
      </div>

      {/* Mini player — only rendered when audio is actively playing */}
      {playing ? (
        <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-border bg-surface lg:bottom-0 lg:left-[248px]">
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
      ) : null}

      {/* Persistent Mobile Bottom Navigation Dock (Always accessible, including in Chat) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[56px] items-center justify-around border-t border-border-subtle bg-background/95 backdrop-blur-md px-1.5 pb-[env(safe-area-inset-bottom,0px)] lg:hidden select-none shadow-xs"
      >
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.to === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.to);

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 gap-0.5 text-2xs transition-colors duration-150 active:scale-95",
                isActive
                  ? "text-accent font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center h-6 w-10 rounded-full transition-colors",
                  isActive && "bg-accent/15"
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
              </div>
              <span className="text-[10px] tracking-tight leading-none">
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* More Tab -> opens the slide-out Sheet Drawer */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 gap-0.5 text-2xs transition-colors duration-150 active:scale-95 cursor-pointer outline-none",
            mobileDrawerOpen
              ? "text-accent font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Open more menu"
        >
          <div
            className={cn(
              "relative flex items-center justify-center h-6 w-10 rounded-full transition-colors",
              mobileDrawerOpen && "bg-accent/15 text-accent"
            )}
          >
            <Menu size={18} strokeWidth={mobileDrawerOpen ? 2.2 : 1.75} />
          </div>
          <span className="text-[10px] tracking-tight leading-none">More</span>
        </button>
      </nav>

      {/* Slide-out Mobile Navigation Drawer */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[300px] p-0 flex flex-col bg-background border-r border-border shadow-dialog"
        >
          {/* Drawer Header */}
          <div className="px-5 pt-6 pb-4 border-b border-border-subtle flex items-center justify-between">
            <Link
              to="/"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-baseline gap-2"
            >
              <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Libria
              </span>
              <span className="text-3xs font-mono text-muted-foreground uppercase tracking-wider">
                Reader & AI
              </span>
            </Link>
          </div>

          {/* Quick Search Trigger */}
          <div className="p-3 pb-1">
            <Link
              to="/search"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center gap-2.5 w-full rounded-md border border-border bg-reading px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-accent"
            >
              <Search size={14} className="text-faint" />
              <span className="flex-1 text-left">Search library, notes...</span>
            </Link>
          </div>

          {/* Navigation Links (Scrollable area) */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
            <div>
              <p className="px-2.5 pb-1.5 text-metadata uppercase tracking-wider text-3xs text-muted-foreground/70">
                Main
              </p>
              <div className="space-y-0.5">
                {primaryNav.map((i) => (
                  <NavLink
                    key={i.to}
                    {...i}
                    onClick={() => setMobileDrawerOpen(false)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="px-2.5 pb-1.5 text-metadata uppercase tracking-wider text-3xs text-muted-foreground/70">
                Tools & Content
              </p>
              <div className="space-y-0.5">
                {secondaryNav.map((i) => (
                  <NavLink
                    key={i.to}
                    {...i}
                    onClick={() => setMobileDrawerOpen(false)}
                  />
                ))}
              </div>
            </div>

            {collections.length > 0 && (
              <div>
                <p className="px-2.5 pb-1.5 text-metadata uppercase tracking-wider text-3xs text-muted-foreground/70">
                  Collections
                </p>
                <div className="space-y-0.5">
                  {collections.map((c) => (
                    <Link
                      key={c}
                      to="/"
                      search={{ collection: c }}
                      onClick={() => setMobileDrawerOpen(false)}
                      className="block rounded-sm px-2.5 py-[7px] text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      {c}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* Bottom User Card in Drawer */}
          <div className="border-t border-border-subtle p-3 space-y-2 bg-surface/30">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium text-foreground">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-2xs text-muted-foreground">
                  {user?.email || "Signed in"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Link
                to="/settings"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1.5 text-xs text-foreground hover:bg-hover transition-colors"
              >
                <Settings size={13} strokeWidth={1.75} />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                onClick={toggle}
                className="flex items-center justify-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1.5 text-xs text-foreground hover:bg-hover transition-colors cursor-pointer"
              >
                {dark ? <Sun size={13} strokeWidth={1.75} /> : <Moon size={13} strokeWidth={1.75} />}
                <span>{dark ? "Light" : "Dark"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false);
                void handleSignOut();
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut size={13} strokeWidth={1.75} />
              <span>Log out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
