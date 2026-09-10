import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Libria — Personal AI Library & Mentor" },
      { name: "description", content: "AI-native personal wisdom library and self-development mentor" },
      { name: "author", content: "Libria" },
      { property: "og:title", content: "Libria — Personal AI Library & Mentor" },
      { property: "og:description", content: "AI-native personal wisdom library and self-development mentor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Public-only credentials injected safely for client hydration resilience
  const publicEnv = {
    VITE_SUPABASE_URL:
      typeof process !== "undefined" && process.env
        ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "")
        : "",
    VITE_SUPABASE_PUBLISHABLE_KEY:
      typeof process !== "undefined" && process.env
        ? (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
           process.env.VITE_SUPABASE_ANON_KEY ||
           process.env.SUPABASE_PUBLISHABLE_KEY ||
           process.env.SUPABASE_ANON_KEY ||
           "")
        : "",
  };

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = Object.assign(window.__ENV__ || {}, ${JSON.stringify(publicEnv)});`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/* ---------- Route protection ---------- */

const PUBLIC_ROUTES = ["/login", "/verify"];

function AuthGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Track client-side hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect logic (client-side only, after hydration).
  useEffect(() => {
    if (!mounted || loading) return;

    if (!user && !isPublicRoute) {
      navigate({ to: "/login", replace: true });
    } else if (user && pathname === "/login") {
      navigate({ to: "/", replace: true });
    }
  }, [user, loading, isPublicRoute, pathname, navigate, mounted]);

  // Public routes (login, verify) always render immediately — no auth gate.
  if (isPublicRoute) {
    return <Outlet />;
  }

  // Protected routes: show loading screen during SSR, hydration, and
  // while the session is being resolved. Content NEVER renders without auth.
  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <span className="font-serif text-lg font-semibold tracking-[-0.01em] text-foreground">
            Libria
          </span>
          <div className="mt-4 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to /login is in flight, keep the loading shell
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <span className="font-serif text-lg font-semibold tracking-[-0.01em] text-foreground">
            Libria
          </span>
          <div className="mt-4 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  // Authenticated — render the app.
  return <Outlet />;
}
