import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start preloading immediately on user intent (hover / touch-start)
    defaultPreload: "intent",
    // 50ms debounce prevents accidental mouse-overs from firing unnecessary requests
    defaultPreloadDelay: 50,
    // Preloaded data stays fresh for 60s so clicking uses the prefetched cache with zero wait
    defaultPreloadStaleTime: 60_000,
    // Route loaders stay fresh for 60s so navigating back from a book renders in 0ms
    defaultStaleTime: 60_000,
    // Keep unused route caches in memory for 15 minutes
    defaultGcTime: 15 * 60_000,
  });

  return router;
};
