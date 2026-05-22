import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache aggressively so navigating back to a page is instant.
        staleTime: 5 * 60 * 1000, // 5 min — data considered fresh
        gcTime: 30 * 60 * 1000, // 30 min — keep in memory after unmount
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route data on link hover/intent so navigation feels instant.
    defaultPreload: "intent",
    // Let TanStack Query own freshness (its own staleTime is 5 min above).
    // Router's preload cache at >0 would mask Query and serve stale data.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
