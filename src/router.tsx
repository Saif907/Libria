import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Loaders here hit GCS, so the difference between prefetching on hover and
    // fetching on click is the difference between instant and a visible wait.
    defaultPreload: "intent",
    // Preloaded data has to survive long enough to actually serve the click it
    // was fetched for; 0 would refetch and waste the prefetch entirely.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
