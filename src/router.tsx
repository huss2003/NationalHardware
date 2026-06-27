import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "./components/erp/RoutePending";

export const localStoragePersister = typeof window !== "undefined"
  ? createSyncStoragePersister({ storage: localStorage, key: "scanflow-query-cache" })
  : undefined;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
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
    // Show a skeleton shell almost immediately instead of a blank white screen
    // while a route's code chunk / data loads.
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 80,
    defaultPendingMinMs: 300,
    // Smooth cross-fade between routes using the browser View Transitions API.
    defaultViewTransition: true,
  });

  return router;
};
